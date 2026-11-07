import '../../styles/marketing-content.css';
import ShowcaseCardCanvas from '../../../.storybook/ShowcaseCardCanvas.astro';

export default {
  title: 'Marketing/ShowcaseCard',
  component: ShowcaseCardCanvas,
  args: { theme: 'light', variant: 'vector-wave' },
};

export const VectorWaveLight = {};
export const VectorWaveDark = { args: { theme: 'dark' } };
export const NativeVideoLight = { args: { variant: 'native-video' } };
export const NativeVideoDark = { args: { variant: 'native-video', theme: 'dark' } };
export const MinimalLight = { args: { variant: 'minimal' } };
export const MinimalDark = { args: { variant: 'minimal', theme: 'dark' } };
export const LongLight = { args: { variant: 'long' } };
export const LongDark = { args: { variant: 'long', theme: 'dark' } };
