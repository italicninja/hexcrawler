/**
 * GameLog component - displays game messages and events
 */
export class GameLog {
    constructor(container) {
        this.container = container;
        this.messages = [];
        this.maxMessages = 100;
        this.render();
    }

    /**
     * Add a message to the log
     */
    addMessage(text, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        this.messages.push({ text, type, timestamp });

        // Keep only the last maxMessages
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this.render();
        this.scrollToBottom();
    }

    /**
     * Clear all messages
     */
    clear() {
        this.messages = [];
        this.render();
    }

    /**
     * Render the log
     */
    render() {
        const messagesHTML = this.messages
            .map(msg => `
                <div class="log-entry log-${msg.type}">
                    <span class="log-timestamp">[${msg.timestamp}]</span>
                    <span class="log-text">${msg.text}</span>
                </div>
            `)
            .join('');

        this.container.innerHTML = `
            <div class="log-header">
                <h3>Game Log</h3>
            </div>
            <div class="log-messages" id="log-messages">
                ${messagesHTML || '<div class="log-placeholder">Game events will appear here...</div>'}
            </div>
        `;
    }

    /**
     * Scroll to the bottom of the log
     */
    scrollToBottom() {
        const messagesContainer = this.container.querySelector('#log-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}
