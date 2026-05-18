import type React from 'react';
import { Composition } from 'remotion';
import { RestafyPresentation, type RestafyPresentationProps } from './RestafyPresentation';

export const Root: React.FC = () => {
  return (
    <Composition
      id="RestafyPresentation"
      component={RestafyPresentation}
      durationInFrames={1350}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={
        {
          demoUrl: 'https://restafy.shop/demo',
          appUrl: 'https://app.restafy.shop',
          vitrineUrl: 'https://restafy.shop',
        } satisfies RestafyPresentationProps
      }
    />
  );
};
