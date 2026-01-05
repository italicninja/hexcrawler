/**
 * PartyUI component - displays the party composition
 */
export class PartyUI {
    constructor(party, container, onMemberClick) {
        this.party = party;
        this.container = container;
        this.onMemberClick = onMemberClick;
        this.selectedIndex = null;
    }

    /**
     * Render the party UI
     */
    render() {
        if (!this.party) {
            this.container.innerHTML = '<div>No party</div>';
            return;
        }

        const members = this.party.getAllMembers();

        let html = '<div class="party-container">';

        // Only render non-null members
        members.forEach((member, index) => {
            if (member) {
                const isPlayer = index === 0;
                html += this.renderMember(member, index, isPlayer);
            }
        });

        html += '</div>';

        this.container.innerHTML = html;

        // Add click listeners
        this.setupClickListeners();
    }

    /**
     * Render a single party member
     */
    renderMember(member, index, isPlayer) {
        const hpPercent = (member.currentHP / member.maxHP) * 100;
        const hpColor = this.getHPColor(hpPercent);
        const initial = member.name.charAt(0).toUpperCase();
        const isSelected = this.selectedIndex === index;
        const selectedClass = isSelected ? 'selected' : '';

        return `
            <div class="party-member ${selectedClass}" data-member-index="${index}">
                <div class="party-icon">${initial}</div>
                <div class="party-info">
                    <div class="party-name">${member.name}</div>
                    <div class="party-hp">
                        <span style="color: ${hpColor}">
                            ${member.currentHP}/${member.maxHP} HP
                        </span>
                        • Lv${member.level} ${this.capitalize(member.class)}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Setup click listeners for party members
     */
    setupClickListeners() {
        const memberElements = this.container.querySelectorAll('.party-member');
        memberElements.forEach(element => {
            element.addEventListener('click', () => {
                const index = parseInt(element.dataset.memberIndex);
                this.selectMember(index);
            });
        });
    }

    /**
     * Select a party member
     */
    selectMember(index) {
        this.selectedIndex = index;

        // Update visual selection
        const memberElements = this.container.querySelectorAll('.party-member');
        memberElements.forEach(element => {
            const elementIndex = parseInt(element.dataset.memberIndex);
            if (elementIndex === index) {
                element.classList.add('selected');
            } else {
                element.classList.remove('selected');
            }
        });

        // Trigger callback
        if (this.onMemberClick) {
            const members = this.party.getAllMembers();
            this.onMemberClick(members[index], index);
        }
    }

    /**
     * Get color based on HP percentage
     */
    getHPColor(percent) {
        if (percent > 75) return '#10b981'; // Green
        if (percent > 50) return '#eab308'; // Yellow
        if (percent > 25) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    }

    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Update party data and re-render
     */
    update(party) {
        this.party = party;
        this.render();
    }
}
