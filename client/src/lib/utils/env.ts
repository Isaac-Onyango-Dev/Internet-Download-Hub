/* eslint-disable @typescript-eslint/no-explicit-any */
export const isElectron = () => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};
