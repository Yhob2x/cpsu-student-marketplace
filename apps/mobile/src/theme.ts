import { useColorScheme } from 'react-native';
const light = { ink: '#1b2838', soft: '#52606f', bg: '#f4f6f3', card: '#ffffff', line: '#d9dfd9', leaf: '#1d6b50', mango: '#f5a623', danger: '#b3261e', onLeaf: '#ffffff' };
const dark = { ink: '#eef2ef', soft: '#a9b5b0', bg: '#121a17', card: '#1a2420', line: '#2e3b36', leaf: '#5fc29c', mango: '#f5a623', danger: '#ff8a80', onLeaf: '#0b100e' };
export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);
