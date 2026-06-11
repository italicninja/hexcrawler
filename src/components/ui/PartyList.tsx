import { useState } from 'react';

/**
 * PartyList component - displays the party composition
 */

interface MemberData {
  name: string;
  currentHP: number;
  maxHP: number;
  level: number;
  class: string;
  gender?: string;
  personality?: string;
  background?: string;
}

interface PartyMemberProps {
  member: MemberData | null;
  index: number;
  isSelected: boolean;
  onClick: (member: MemberData, index: number) => void;
}

interface PartyLike {
  getAllMembers(): (MemberData | null)[];
}

interface PartyListProps {
  party: PartyLike | null;
  onMemberSelect?: (member: MemberData, index: number) => void;
}

function getHPColor(percent: number): string {
  if (percent > 75) return '#10b981'; // Green
  if (percent > 50) return '#eab308'; // Yellow
  if (percent > 25) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function PartyMember({ member, index, isSelected, onClick }: PartyMemberProps) {
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

function PartyList({ party, onMemberSelect }: PartyListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!party) {
    return <div>No party</div>;
  }

  const members = party.getAllMembers();

  const handleMemberClick = (member: MemberData, index: number) => {
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

export default PartyList;
