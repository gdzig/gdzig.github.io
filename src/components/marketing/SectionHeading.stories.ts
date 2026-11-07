import '../../styles/marketing-content.css';
import SectionHeadingCanvas from '../../../.storybook/SectionHeadingCanvas.astro';

export default {
  title: 'Marketing/SectionHeading',
  component: SectionHeadingCanvas,
  args: { theme: 'light', variant: 'games' },
};

export const GamesLight = {};
export const GamesDark = { args: { theme: 'dark' } };
export const LongLight = { args: { variant: 'long' } };
export const LongDark = { args: { variant: 'long', theme: 'dark' } };
