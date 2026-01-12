/**
 * Validators - UI validation helpers for QA testing
 * 
 * Provides assertion and validation functions for common game state checks.
 * Throws errors on validation failure with descriptive messages.
 */

export class Validators {
  /**
   * Validate player position matches expected
   */
  static validatePosition(actual, expected, message = 'Position mismatch') {
    if (!actual) {
      throw new Error(`${message}: Could not read player position`);
    }
    
    if (actual.col !== expected.col || actual.row !== expected.row) {
      throw new Error(
        `${message}: Expected (${expected.col}, ${expected.row}), got (${actual.col}, ${actual.row})`
      );
    }
  }

  /**
   * Validate scene matches expected
   */
  static validateScene(actual, expected, message = 'Scene mismatch') {
    if (actual !== expected) {
      throw new Error(`${message}: Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Validate game log contains message
   */
  static validateLogMessage(logs, expectedText, message = 'Log message not found') {
    const found = logs.some(log => log.includes(expectedText));
    if (!found) {
      throw new Error(`${message}: "${expectedText}" not found in logs`);
    }
  }

  /**
   * Validate value is greater than threshold
   */
  static validateGreaterThan(actual, threshold, valueName = 'Value') {
    if (actual <= threshold) {
      throw new Error(`${valueName}: Expected > ${threshold}, got ${actual}`);
    }
  }

  /**
   * Validate value is less than threshold
   */
  static validateLessThan(actual, threshold, valueName = 'Value') {
    if (actual >= threshold) {
      throw new Error(`${valueName}: Expected < ${threshold}, got ${actual}`);
    }
  }

  /**
   * Validate value equals expected
   */
  static validateEquals(actual, expected, valueName = 'Value') {
    if (actual !== expected) {
      throw new Error(`${valueName}: Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Validate value is within range
   */
  static validateRange(actual, min, max, valueName = 'Value') {
    if (actual < min || actual > max) {
      throw new Error(`${valueName}: Expected ${min}-${max}, got ${actual}`);
    }
  }

  /**
   * Validate no console errors
   */
  static validateNoConsoleErrors(errors, allowedPatterns = []) {
    const filtered = errors.filter(error => {
      // Filter out allowed error patterns (e.g., known warnings)
      return !allowedPatterns.some(pattern => 
        error.text.includes(pattern)
      );
    });

    if (filtered.length > 0) {
      const errorMessages = filtered.map(e => e.text).join('\n');
      throw new Error(`Console errors detected:\n${errorMessages}`);
    }
  }

  /**
   * Validate combat state is active
   */
  static validateCombatActive(combatState, message = 'Combat not active') {
    if (!combatState || !combatState.active) {
      throw new Error(message);
    }
  }

  /**
   * Validate resource amount (gold, rations, etc.)
   */
  static validateResource(actual, expected, resourceName, operator = '>=') {
    let valid = false;
    let expectedStr = '';

    switch (operator) {
      case '>=':
        valid = actual >= expected;
        expectedStr = `>= ${expected}`;
        break;
      case '<=':
        valid = actual <= expected;
        expectedStr = `<= ${expected}`;
        break;
      case '==':
        valid = actual === expected;
        expectedStr = `== ${expected}`;
        break;
      case '>':
        valid = actual > expected;
        expectedStr = `> ${expected}`;
        break;
      case '<':
        valid = actual < expected;
        expectedStr = `< ${expected}`;
        break;
      default:
        throw new Error(`Invalid operator: ${operator}`);
    }

    if (!valid) {
      throw new Error(
        `${resourceName} validation failed: Expected ${expectedStr}, got ${actual}`
      );
    }
  }

  /**
   * Soft validation - returns true/false instead of throwing
   */
  static softValidate(validationFn, ...args) {
    try {
      validationFn(...args);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create custom validation error
   */
  static createError(message, details = {}) {
    const error = new Error(message);
    error.details = details;
    return error;
  }
}
