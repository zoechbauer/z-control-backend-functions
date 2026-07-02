import { UserType } from '../../shared/app.constants.js';
import { ProgrammerDeviceUID } from '../../shared/firebase-firestore.interfaces.js';

/**
 * Extracts a readable error message from an error object or string.
 * @param {any} error The error object or string.
 * @param {string} [errorMessage='An unknown error occurred.'] The default error message to return if no specific message is found.
 * @return {string} The extracted error message.
 */
const getErrorMsg = (
  error: any,
  errorMessage = 'An unknown error occurred.',
): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = error.message || errorMessage;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  return errorMessage;
};

/**
 * Validates a programmer device entry has required fields.
 * @param {ProgrammerDeviceUID} device The device to validate.
 * @return {boolean} True if the device is valid, false otherwise.
 */
const isValidDevice = (device: ProgrammerDeviceUID): boolean => {
  if (!device.userId || !device.name) {
    console.warn('Skipping device without userId or name:', device);
    return false;
  }
  return true;
};

/**
 * Resolves the device name for a given userId from the provided list.
 * @param {string} userId The user ID to look up.
 * @param {ProgrammerDeviceUID[]} programmerDeviceUIDs The list of programmer device UIDs.
 * @return {string} The device name if found, otherwise 'unknown'.
 */
const getDeviceName = (
  userId: string,
  programmerDeviceUIDs: ProgrammerDeviceUID[],
): string => {
  const device = programmerDeviceUIDs.find((d) => d.userId === userId);
  return device ? device.name : 'unknown';
};

/**
 * Determines user type based on presence in the programmer device list.
 * @param {string} userId The user ID to check.
 * @param {ProgrammerDeviceUID[]} programmerDeviceUIDs The list of programmer device UIDs.
 * @return {string} The user type.
 */
const getUserType = (
  userId: string,
  programmerDeviceUIDs: ProgrammerDeviceUID[],
): string => {
  return programmerDeviceUIDs.some((d) => d.userId === userId)
    ? UserType.Programmer
    : UserType.User;
};

export { getErrorMsg, isValidDevice, getDeviceName, getUserType };
