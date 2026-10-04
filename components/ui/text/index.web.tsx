import type { VariantProps } from '@gluestack-ui/nativewind-utils';
import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { textStyle } from './styles';

type ITextProps = React.ComponentProps<'span'> &
  VariantProps<typeof textStyle> & {
    numberOfLines?: number;
  };

const Text = React.forwardRef<React.ComponentRef<'span'>, ITextProps>(
  function Text(
    {
      className,
      isTruncated,
      bold,
      underline,
      strikeThrough,
      size = 'md',
      sub,
      italic,
      highlight,
      numberOfLines,
      style,
      ...props
    }: { className?: string } & ITextProps,
    ref
  ) {
    return (
      <span
        className={textStyle({
          isTruncated,
          bold,
          underline,
          strikeThrough,
          size,
          sub,
          italic,
          highlight,
          class: className,
        })}
        {...props}
        style={{
          ...StyleSheet.flatten(style as StyleProp<TextStyle>),
          ...(numberOfLines
            ? {
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: numberOfLines,
                overflow: 'hidden',
              }
            : {}),
        } as React.CSSProperties}
        ref={ref}
      />
    );
  }
);

Text.displayName = 'Text';

export { Text };

