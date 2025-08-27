// 任务管理类
class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentTab = 'all';
        this.init();
    }

    async init() {
        await this.loadTasks();
        this.bindEvents();
        this.renderTasks();
    }

    // 加载任务数据
    async loadTasks() {
        try {
            const result = await chrome.storage.local.get(['flowdoTasks']);
            this.tasks = result.flowdoTasks || [];
        } catch (error) {
            console.error('加载任务失败:', error);
        }
    }

    // 保存任务数据
    async saveTasks() {
        try {
            await chrome.storage.local.set({ flowdoTasks: this.tasks });
        } catch (error) {
            console.error('保存任务失败:', error);
        }
    }

    // 绑定事件
    bindEvents() {
        // 新建任务按钮
        document.getElementById('addTaskBtn').addEventListener('click', () => {
            this.showModal();
        });

        // 关闭模态框
        document.getElementById('closeModal').addEventListener('click', () => {
            this.hideModal();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        // 提交表单
        document.getElementById('taskForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createTask();
        });

        // 标签页切换
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 点击模态框背景关闭
        document.getElementById('taskModal').addEventListener('click', (e) => {
            if (e.target.id === 'taskModal') {
                this.hideModal();
            }
        });
    }

    // 显示模态框
    showModal() {
        document.getElementById('taskModal').style.display = 'flex';
        document.getElementById('taskTitle').focus();
    }

    // 隐藏模态框
    hideModal() {
        document.getElementById('taskModal').style.display = 'none';
        document.getElementById('taskForm').reset();
    }

    // 创建任务
    async createTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const desc = document.getElementById('taskDesc').value.trim();
        const type = document.getElementById('taskType').value;
        const priority = document.getElementById('taskPriority').value;
        const reminderTime = document.getElementById('reminderTime').value;

        if (!title) {
            alert('请输入任务标题');
            return;
        }

        const task = {
            id: Date.now().toString(),
            title,
            description: desc,
            type,
            priority,
            status: 'pending',
            createdAt: new Date().toISOString(),
            reminderTime: reminderTime || null,
            order: this.tasks.length
        };

        this.tasks.push(task);
        await this.saveTasks();

        // 设置提醒
        if (reminderTime) {
            this.setReminder(task);
        }

        this.hideModal();
        this.renderTasks();
    }

    // 设置提醒
    async setReminder(task) {
        try {
            const reminderDate = new Date(task.reminderTime);
            const now = new Date();
            
            if (reminderDate > now) {
                await chrome.alarms.create(`task_${task.id}`, {
                    when: reminderDate.getTime()
                });
            }
        } catch (error) {
            console.error('设置提醒失败:', error);
        }
    }

    // 切换标签页
    switchTab(tab) {
        this.currentTab = tab;
        
        // 更新标签页样式
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        this.renderTasks();
    }

    // 渲染任务列表
    renderTasks() {
        const taskList = document.getElementById('taskList');
        const emptyState = document.getElementById('emptyState');
        
        let filteredTasks = this.tasks;
        
        // 根据当前标签页过滤任务
        if (this.currentTab !== 'all') {
            filteredTasks = this.tasks.filter(task => {
                switch (this.currentTab) {
                    case 'pending': return task.status === 'pending';
                    case 'progress': return task.status === 'progress';
                    case 'completed': return task.status === 'completed';
                    default: return true;
                }
            });
        }

        // 按优先级和创建时间排序
        filteredTasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return new Date(a.createdAt) - new Date(b.createdAt);
        });

        if (filteredTasks.length === 0) {
            taskList.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            taskList.style.display = 'block';
            emptyState.style.display = 'none';
            taskList.innerHTML = filteredTasks.map(task => this.createTaskElement(task)).join('');
            
            // 绑定任务事件
            this.bindTaskEvents();
        }
    }

    // 创建任务元素
    createTaskElement(task) {
        const typeEmojis = {
            work: '📝',
            life: '🏠',
            study: '📚',
            idea: '💡',
            goal: '🎯',
            shopping: '🛒'
        };

        const priorityColors = {
            high: '#ff4757',
            medium: '#ffa502',
            low: '#2ed573'
        };

        const statusEmojis = {
            pending: '🟡',
            progress: '🔵',
            completed: '✅'
        };

        return `
            <div class="task-item" data-id="${task.id}" draggable="true">
                <div class="task-header">
                    <span class="task-type">${typeEmojis[task.type]}</span>
                    <span class="task-status">${statusEmojis[task.status]}</span>
                    <div class="task-actions">
                        ${task.reminderTime ? '<span class="reminder-icon">⏰</span>' : ''}
                        <button class="edit-btn" data-id="${task.id}">✏️</button>
                        <button class="delete-btn" data-id="${task.id}">🗑️</button>
                    </div>
                </div>
                <div class="task-content">
                    <h4 class="task-title">${task.title}</h4>
                    ${task.description ? `<p class="task-desc">${task.description}</p>` : ''}
                    <div class="task-meta">
                        <span class="priority" style="color: ${priorityColors[task.priority]}">
                            ${task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'} 
                            ${task.priority === 'high' ? '高' : task.priority === 'medium' ? '中' : '低'}优先级
                        </span>
                        <span class="created-time">${new Date(task.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="status-controls">
                    <select class="status-select" data-id="${task.id}">
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>🟡 待执行</option>
                        <option value="progress" ${task.status === 'progress' ? 'selected' : ''}>🔵 进行中</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>✅ 已完成</option>
                    </select>
                </div>
            </div>
        `;
    }

    // 绑定任务事件
    bindTaskEvents() {
        // 状态变更
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.updateTaskStatus(e.target.dataset.id, e.target.value);
            });
        });

        // 删除任务
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.deleteTask(e.target.dataset.id);
            });
        });

        // 拖拽事件
        document.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const draggedId = e.dataTransfer.getData('text/plain');
                const targetId = e.target.closest('.task-item').dataset.id;
                this.reorderTasks(draggedId, targetId);
            });
        });
    }

    // 更新任务状态
    async updateTaskStatus(taskId, newStatus) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.status = newStatus;
            await this.saveTasks();
            this.renderTasks();
        }
    }

    // 删除任务
    async deleteTask(taskId) {
        if (confirm('确定要删除这个任务吗？')) {
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            await this.saveTasks();
            
            // 删除相关提醒
            try {
                await chrome.alarms.clear(`task_${taskId}`);
            } catch (error) {
                console.error('删除提醒失败:', error);
            }
            
            this.renderTasks();
        }
    }

    // 重新排序任务
    async reorderTasks(draggedId, targetId) {
        const draggedIndex = this.tasks.findIndex(t => t.id === draggedId);
        const targetIndex = this.tasks.findIndex(t => t.id === targetId);
        
        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [draggedTask] = this.tasks.splice(draggedIndex, 1);
            this.tasks.splice(targetIndex, 0, draggedTask);
            
            // 更新order字段
            this.tasks.forEach((task, index) => {
                task.order = index;
            });
            
            await this.saveTasks();
            this.renderTasks();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new TaskManager();
});