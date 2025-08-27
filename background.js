// 后台服务工作者
class BackgroundService {
    constructor() {
        this.init();
    }

    init() {
        // 监听闹钟事件
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // 监听安装事件
        chrome.runtime.onInstalled.addListener(() => {
            this.onInstalled();
        });

        // 监听存储变化
        chrome.storage.onChanged.addListener((changes, namespace) => {
            this.onStorageChanged(changes, namespace);
        });
    }

    // 处理闹钟触发
    async handleAlarm(alarm) {
        if (alarm.name.startsWith('task_')) {
            const taskId = alarm.name.replace('task_', '');
            await this.showTaskNotification(taskId);
        }
    }

    // 显示任务通知
    async showTaskNotification(taskId) {
        try {
            // 获取任务数据
            const result = await chrome.storage.local.get(['flowdoTasks']);
            const tasks = result.flowdoTasks || [];
            const task = tasks.find(t => t.id === taskId);

            if (task) {
                // 创建通知
                await chrome.notifications.create(`task_notification_${taskId}`, {
                    type: 'basic',
                    iconUrl: 'images/icon48.png',
                    title: '📋 FlowDo 任务提醒',
                    message: `⏰ ${task.title}\n${task.description || ''}`,
                    buttons: [
                        { title: '标记完成' },
                        { title: '稍后提醒' }
                    ],
                    requireInteraction: true
                });

                // 播放提示音（如果支持）
                this.playNotificationSound();
            }
        } catch (error) {
            console.error('显示通知失败:', error);
        }
    }

    // 播放提示音
    playNotificationSound() {
        // 注意：Chrome扩展中播放音频需要特殊处理
        // 这里可以通过创建audio元素或使用Web Audio API
        try {
            // 简单的提示音实现
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'playNotificationSound'
                    }).catch(() => {
                        // 忽略错误，可能页面不支持content script
                    });
                }
            });
        } catch (error) {
            console.error('播放提示音失败:', error);
        }
    }

    // 处理通知按钮点击
    async handleNotificationButtonClick(notificationId, buttonIndex) {
        if (notificationId.startsWith('task_notification_')) {
            const taskId = notificationId.replace('task_notification_', '');
            
            if (buttonIndex === 0) {
                // 标记完成
                await this.markTaskCompleted(taskId);
            } else if (buttonIndex === 1) {
                // 稍后提醒（5分钟后）
                await this.snoozeTask(taskId, 5);
            }
            
            // 清除通知
            chrome.notifications.clear(notificationId);
        }
    }

    // 标记任务完成
    async markTaskCompleted(taskId) {
        try {
            const result = await chrome.storage.local.get(['flowdoTasks']);
            const tasks = result.flowdoTasks || [];
            const task = tasks.find(t => t.id === taskId);
            
            if (task) {
                task.status = 'completed';
                task.completedAt = new Date().toISOString();
                await chrome.storage.local.set({ flowdoTasks: tasks });
            }
        } catch (error) {
            console.error('标记任务完成失败:', error);
        }
    }

    // 延迟提醒
    async snoozeTask(taskId, minutes) {
        try {
            const snoozeTime = Date.now() + (minutes * 60 * 1000);
            await chrome.alarms.create(`task_${taskId}`, {
                when: snoozeTime
            });
        } catch (error) {
            console.error('设置延迟提醒失败:', error);
        }
    }

    // 扩展安装时的初始化
    onInstalled() {
        console.log('FlowDo 扩展已安装');
        
        // 设置默认数据
        chrome.storage.local.get(['flowdoTasks'], (result) => {
            if (!result.flowdoTasks) {
                chrome.storage.local.set({
                    flowdoTasks: [],
                    settings: {
                        theme: 'light',
                        soundEnabled: true,
                        defaultReminder: 15 // 默认提前15分钟提醒
                    }
                });
            }
        });
    }

    // 存储变化监听
    onStorageChanged(changes, namespace) {
        if (namespace === 'local' && changes.flowdoTasks) {
            // 任务数据发生变化时的处理
            console.log('任务数据已更新');
        }
    }

    // 获取当前时间的格式化字符串
    getCurrentTimeString() {
        return new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // 清理过期的闹钟
    async cleanupExpiredAlarms() {
        try {
            const alarms = await chrome.alarms.getAll();
            const now = Date.now();
            
            for (const alarm of alarms) {
                if (alarm.name.startsWith('task_') && alarm.scheduledTime < now) {
                    await chrome.alarms.clear(alarm.name);
                }
            }
        } catch (error) {
            console.error('清理过期闹钟失败:', error);
        }
    }
}

// 监听通知按钮点击
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    backgroundService.handleNotificationButtonClick(notificationId, buttonIndex);
});

// 监听通知点击
chrome.notifications.onClicked.addListener((notificationId) => {
    // 点击通知时打开popup
    chrome.action.openPopup();
    chrome.notifications.clear(notificationId);
});

// 初始化后台服务
const backgroundService = new BackgroundService();

// 定期清理过期闹钟（每小时执行一次）
setInterval(() => {
    backgroundService.cleanupExpiredAlarms();
}, 60 * 60 * 1000);