import { useState } from 'react';
import PixelIcon from './PixelIcon';
import './PartyList.css';

/**
 * PartyList component - the company roll of the journal. Selecting a member picks
 * whose equipment the Equipment page shows.
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function PartyMember({ member, index, isSelected, onClick }: PartyMemberProps) {
  // Defensive null check
  if (!member) {
    return null;
  }

  const hpPercent = (member.currentHP / member.maxHP) * 100;
  const details = [
    `Level ${member.level} ${capitalize(member.class)}`,
    member.personality && capitalize(member.personality),
    member.background && capitalize(member.background),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      className={isSelected ? 'is-selected' : undefined}
      aria-pressed={isSelected}
      onClick={() => onClick(member, index)}
    >
      <PixelIcon name={`player:${member.class}`} scale={2} />
      <span className="pl-info">
        <span className="pl-name">
          {member.name}
          {index === 0 && <span className="jp-note"> (you)</span>}
          {member.gender && (
            <PixelIcon name={member.gender === 'male' ? 'male' : 'female'} label={member.gender} />
          )}
        </span>
        <span className="jp-note">{details}</span>
      </span>
      <span className="pl-hp">
        <span className={hpPercent <= 25 ? 'pl-low' : undefined}>
          {member.currentHP} / {member.maxHP} hp
        </span>
        <span className="jp-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(Math.max(hpPercent, 0), 100)}%` }} />
        </span>
      </span>
    </button>
  );
}

function PartyList({ party, onMemberSelect }: PartyListProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (!party) {
    return <p className="jp-prose jp-muted">You have no company to speak of.</p>;
  }

  const members = party.getAllMembers();
  const companions = members.filter(Boolean).length - 1;

  const handleMemberClick = (member: MemberData, index: number) => {
    setSelectedIndex(index);
    if (onMemberSelect) {
      onMemberSelect(member, index);
    }
  };

  return (
    <div>
      <h3 className="jp-heading">The company</h3>
      <div className="jp-list">
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
      {companions < 1 ? (
        <p className="jp-prose jp-muted pl-foot">
          You travel alone. Those who join you on the road will be written in here.
        </p>
      ) : (
        <p className="jp-note pl-foot">
          Choose a name to see what they carry on the Equipment page.
        </p>
      )}
    </div>
  );
}

export default PartyList;
