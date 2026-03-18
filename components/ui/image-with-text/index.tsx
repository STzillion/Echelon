import React from 'react';
import { Image, ImageProps, ImageSourcePropType } from 'react-native';

interface Props extends Omit<ImageProps, 'source'> {
  source: ImageSourcePropType;
  textArray?: string[];
}

const ImageWithText: React.FC<Props> = ({ textArray, ...props }) => {
  // `textArray` accepted for future use (e.g., overlay parsing). Currently unused.
  return <Image {...props} />;
};

export default ImageWithText;
