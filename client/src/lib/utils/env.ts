export const isElectron = () => {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
};
