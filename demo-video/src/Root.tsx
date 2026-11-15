import React from 'react';
import { Composition } from 'remotion';
import { PolarisFilm, FPS, DURATION } from './PolarisFilm';

export const Root: React.FC = () => (
  <Composition id="PolarisFilm" component={PolarisFilm} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
);
