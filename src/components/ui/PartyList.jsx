import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * PartyList component - displays the party composition
 */

function getHPColor(percent) {
  if (percent > 75) return '#10b981'; // Green
  if (percent > 50) return '#eab308'; // Yellow
  if (percent > 25) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function PartyMember({ member, index, isSelected, onClick }) {
  // Defensive null check
  if (!member) {
    return null;
  }

  const hpPercent = (member.currentHP / member.maxHP) * 100;
  const hpColor = getHPColor(hpPercent);
  const initial = member.name.charAt(0).toUpperCase();

  return (
    <div
      className={`party-member ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(member, index)}
      style={{ cursor: 'pointer' }}
    >
      <div className="party-icon">{initial}</div>
      <div className="party-info">
        <div className="party-name">
          {member.name}
          {member.gender && (
            <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', opacity: 0.6 }}>
              ({member.gender === 'male' ? '♂' : '♀'})
            </span>
          )}
        </div>
        <div className="party-hp">
          <span style={{ color: hpColor }}>
            {member.currentHP}/{member.maxHP} HP
          </span>
          {' • '}Lv{member.level} {capitalize(member.class)}
        </div>
        {member.personality && (
          <div
            className="party-personality"
            style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}
          >
            {capitalize(member.personality)}
          </div>
        )}
        {member.background && (
          <div
            className="party-background"
            style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.1rem', fontStyle: 'italic' }}
          >
            {capitalize(member.background)}
          </div>
        )}
      </div>
    </div>
  );
}

PartyMember.propTypes = {
  member: PropTypes.shape({
    name: PropTypes.string.isRequired,
    currentHP: PropTypes.number.isRequired,
    maxHP: PropTypes.number.isRequired,
    level: PropTypes.number.isRequired,
    class: PropTypes.string.isRequired,
    personality: PropTypes.string,
    background: PropTypes.string,
    gender: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

function PartyList({ party, onMemberSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!party) {
    return <div>No party</div>;
  }

  const members = party.getAllMembers();

  const handleMemberClick = (member, index) => {
    setSelectedIndex(index);
    if (onMemberSelect) {
      onMemberSelect(member, index);
    }
  };

  return (
    <div className="party-container">
      {members.map((member, index) =>
        member ? (
          <PartyMember
            key={index}
            member={member}
            index={index}
            isSelected={selectedIndex === index}
            onClick={handleMemberClick}
          />
        ) : null
      )}
    </div>
  );
}

PartyList.propTypes = {
  party: PropTypes.shape({
    getAllMembers: PropTypes.func.isRequired,
  }),
  onMemberSelect: PropTypes.func,
};

export default PartyList;
