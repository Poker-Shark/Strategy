import { STATE, saveLocal } from '../state.js';
import { LANE_COLORS, taskStatusColor } from '../data/heroes.js';
import { esc, invalidatePositionCache } from '../utils.js';
import { showModal, showConfirm } from '../ui/modal.js';
import { label } from '../labels.js';

let tasksOpen = false;

export function toggleTasks(closeOthers) {
  tasksOpen = !tasksOpen;
  document.getElementById('taskDrawer').classList.toggle('open', tasksOpen);
  document.getElementById('taskBtn').classList.toggle('active', tasksOpen);
  if (tasksOpen) {
    if (closeOthers) closeOthers();
    renderTasks();
  }
}

export function closeTasks() {
  tasksOpen = false;
  document.getElementById('taskDrawer').classList.remove('open');
  document.getElementById('taskBtn').classList.remove('active');
}

let _onUpdate = null;

export function setTaskUpdateCallback(fn) { _onUpdate = fn; }

function notify() {
  invalidatePositionCache();
  saveLocal();
  renderTasks();
  if (_onUpdate) _onUpdate();
}

export function renderTasks() {
  const drawer = document.getElementById('taskDrawer');
  if (!tasksOpen) return;

  const lanes = ['top', 'mid', 'bot'];
  const laneLabels = STATE.laneNames || { mid: 'Product', top: 'Ops', bot: 'Solver' };

  drawer.innerHTML = `
    <div class="task-header">
      <span class="task-title">TASK PLANNING</span>
      <button class="btn task-close" id="taskClose">&times;</button>
    </div>
    <div class="task-columns">
      ${lanes.map(lane => `
        <div class="task-lane-col">
          <div class="task-lane-header" style="color:${LANE_COLORS[lane]}">
            ${esc(laneLabels[lane] || lane)} Lane
            <span class="task-count">${STATE.towers[lane].length}</span>
          </div>
          <div class="task-list" data-lane="${lane}">
            ${STATE.towers[lane]
              .sort((a, b) => a.order - b.order)
              .map((t, i, arr) => renderTaskItem(t, lane, i, arr.length))
              .join('')}
          </div>
          <button class="btn task-add" data-lane="${lane}">+ Add Task</button>
        </div>
      `).join('')}
    </div>
  `;

  // Wire close
  document.getElementById('taskClose').addEventListener('click', () => toggleTasks());

  // Wire add buttons
  drawer.querySelectorAll('.task-add').forEach(btn => {
    btn.addEventListener('click', () => addTask(btn.dataset.lane));
  });

  // Wire task actions
  drawer.querySelectorAll('.task-item').forEach(el => {
    const lane = el.dataset.lane, id = el.dataset.id;

    el.querySelector('.task-name-edit')?.addEventListener('click', () => editTaskField(lane, id, 'name'));
    el.querySelector('.task-desc-edit')?.addEventListener('click', () => editTaskField(lane, id, 'desc'));
    el.querySelector('.task-status-btn')?.addEventListener('click', () => cycleStatus(lane, id));
    el.querySelector('.task-up')?.addEventListener('click', () => reorder(lane, id, -1));
    el.querySelector('.task-down')?.addEventListener('click', () => reorder(lane, id, 1));
    el.querySelector('.task-delete')?.addEventListener('click', () => deleteTask(lane, id));
  });
}

function renderTaskItem(t, lane, idx, total) {
  const sc = taskStatusColor(t.status);

  return `
    <div class="task-item" data-lane="${lane}" data-id="${t.id}">
      <div class="task-item-header">
        <span class="task-status-btn" style="color:${sc};border-color:${sc}" title="Click to cycle">${t.status}</span>
        <span class="task-name-edit" title="Click to edit">${esc(t.name)}</span>
        <div class="task-item-actions">
          ${idx > 0 ? '<button class="task-arrow task-up" title="Move up">▲</button>' : ''}
          ${idx < total - 1 ? '<button class="task-arrow task-down" title="Move down">▼</button>' : ''}
          <button class="task-arrow task-delete" title="Delete">✕</button>
        </div>
      </div>
      <div class="task-desc-edit" title="Click to edit">${esc(t.desc)}</div>
    </div>
  `;
}

function addTask(lane) {
  showModal({
    title: label('addTower'),
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'desc', label: 'Description', type: 'textarea' },
    ],
    onSave: (v) => {
      STATE.towers[lane].push({ id: 't' + Date.now(), name: v.name, desc: v.desc || '', status: 'locked', order: STATE.towers[lane].length });
      notify();
    },
  });
}

function editTaskField(lane, id, field) {
  const task = STATE.towers[lane].find(t => t.id === id);
  if (!task) return;
  showModal({
    title: 'Edit ' + label('towersSection'),
    fields: [{ key: field, label: field.charAt(0).toUpperCase() + field.slice(1), type: field === 'desc' ? 'textarea' : 'text', value: task[field] }],
    onSave: (v) => { task[field] = v[field]; notify(); },
  });
}

function cycleStatus(lane, id) {
  const task = STATE.towers[lane].find(t => t.id === id);
  if (!task) return;
  const cycle = ['locked', 'next', 'achieved'];
  task.status = cycle[(cycle.indexOf(task.status) + 1) % cycle.length];
  notify();
}

function reorder(lane, id, dir) {
  const arr = STATE.towers[lane];
  const idx = arr.findIndex(t => t.id === id);
  if (idx < 0) return;
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return;
  // Swap order values
  const tmp = arr[idx].order;
  arr[idx].order = arr[target].order;
  arr[target].order = tmp;
  // Re-sort
  arr.sort((a, b) => a.order - b.order);
  // Normalize orders
  arr.forEach((t, i) => t.order = i);
  notify();
}

function deleteTask(lane, id) {
  showConfirm({
    title: label('deleteTower'),
    message: 'This cannot be undone.',
    onConfirm: () => {
      STATE.towers[lane] = STATE.towers[lane].filter(t => t.id !== id);
      STATE.towers[lane].forEach((t, i) => t.order = i);
      notify();
    },
  });
}
