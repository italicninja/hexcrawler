/**
 * TimeManager.js
 * Manages game time tracking for the hexcrawl game.
 * Time is tracked in days, hours, and minutes.
 */

/**
 * Creates a new game time object
 * @returns {{day: number, hour: number, minute: number}}
 */
export function createGameTime() {
  return {
    day: 1,
    hour: 8, // Start at 8:00 AM
    minute: 0
  };
}

/**
 * Advances game time by a specified number of minutes
 * @param {Object} gameTime - Current game time {day, hour, minute}
 * @param {number} minutes - Minutes to advance
 * @returns {Object} New game time object
 */
export function advanceTime(gameTime, minutes) {
  if (!gameTime || typeof minutes !== 'number' || minutes < 0) {
    console.error('Invalid parameters for advanceTime', { gameTime, minutes });
    return gameTime || createGameTime();
  }

  // Create a new time object to maintain immutability
  let { day, hour, minute } = gameTime;

  // Add minutes
  minute += minutes;

  // Handle minute overflow
  if (minute >= 60) {
    const hoursToAdd = Math.floor(minute / 60);
    minute = minute % 60;
    hour += hoursToAdd;
  }

  // Handle hour overflow
  if (hour >= 24) {
    const daysToAdd = Math.floor(hour / 24);
    hour = hour % 24;
    day += daysToAdd;
  }

  return { day, hour, minute };
}

/**
 * Formats game time into a readable string
 * @param {Object} gameTime - Game time {day, hour, minute}
 * @returns {string} Formatted time string like "Day 5, 14:30"
 */
export function formatTime(gameTime) {
  if (!gameTime) {
    return 'Day 1, 08:00';
  }

  const { day, hour, minute } = gameTime;
  const hourStr = String(hour).padStart(2, '0');
  const minuteStr = String(minute).padStart(2, '0');

  return `Day ${day}, ${hourStr}:${minuteStr}`;
}

/**
 * Determines if a given hour is nighttime
 * Night is considered to be from 20:00 (8 PM) to 06:00 (6 AM)
 * @param {number} hour - Hour (0-23)
 * @returns {boolean} True if nighttime
 */
export function isNight(hour) {
  return hour >= 20 || hour < 6;
}

/**
 * Gets the time of day period
 * @param {number} hour - Hour (0-23)
 * @returns {string} Time period: 'night', 'dawn', 'day', 'dusk'
 */
export function getTimeOfDay(hour) {
  if (hour >= 6 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}

/**
 * Time costs for various actions (in minutes)
 */
export const TIME_COSTS = {
  MOVEMENT: 10,           // Per hex
  COMBAT_MIN: 5,          // Minimum combat duration
  COMBAT_MAX: 10,         // Maximum combat duration
  SHORT_REST: 60,         // 1 hour
  LONG_REST: 480,         // 8 hours
  SEARCH: 30,             // Search hex
  EXPLORATION_MIN: 60,    // 1 hour
  EXPLORATION_MAX: 120,   // 2 hours
  CAMP_SETUP: 30,         // Setting up camp
  CAMP_BREAKDOWN: 15      // Breaking down camp
};

/**
 * Gets a random combat duration
 * @returns {number} Minutes (5-10)
 */
export function getCombatDuration() {
  return Math.floor(Math.random() * (TIME_COSTS.COMBAT_MAX - TIME_COSTS.COMBAT_MIN + 1)) + TIME_COSTS.COMBAT_MIN;
}

/**
 * Gets a random exploration duration
 * @returns {number} Minutes (60-120)
 */
export function getExplorationDuration() {
  return Math.floor(Math.random() * (TIME_COSTS.EXPLORATION_MAX - TIME_COSTS.EXPLORATION_MIN + 1)) + TIME_COSTS.EXPLORATION_MIN;
}

/**
 * Calculates time until next dawn (6:00 AM)
 * @param {Object} gameTime - Current game time
 * @returns {number} Minutes until dawn
 */
export function getTimeUntilDawn(gameTime) {
  const { hour, minute } = gameTime;
  const currentMinutes = hour * 60 + minute;
  const dawnMinutes = 6 * 60; // 6:00 AM

  if (currentMinutes < dawnMinutes) {
    // Same day
    return dawnMinutes - currentMinutes;
  } else {
    // Next day
    return (24 * 60 - currentMinutes) + dawnMinutes;
  }
}

/**
 * Calculates time until next dusk (20:00)
 * @param {Object} gameTime - Current game time
 * @returns {number} Minutes until dusk
 */
export function getTimeUntilDusk(gameTime) {
  const { hour, minute } = gameTime;
  const currentMinutes = hour * 60 + minute;
  const duskMinutes = 20 * 60; // 8:00 PM

  if (currentMinutes < duskMinutes) {
    // Same day
    return duskMinutes - currentMinutes;
  } else {
    // Next day
    return (24 * 60 - currentMinutes) + duskMinutes;
  }
}

export default {
  createGameTime,
  advanceTime,
  formatTime,
  isNight,
  getTimeOfDay,
  TIME_COSTS,
  getCombatDuration,
  getExplorationDuration,
  getTimeUntilDawn,
  getTimeUntilDusk
};
