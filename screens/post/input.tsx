import { Text } from "@/components/ui/text";
import { Post } from "@/providers/PostsProvider";
import React from "react";
import { TextInput, View } from "react-native";




export const renderText = (textArray: string[]) => {


  return (
    <Text className="my-2">
      {textArray?.map((part, index) => {
        if (!part) return null;

        if (part?.startsWith("#")) {
          const tag = part?.toUpperCase()
          return (
            <Text style={styles.textIfHash} size="md" key={index}>{tag}</Text>
          );
        }
        else
          return(
            <Text style={styles.Text} size="md" key={index}>{part}</Text>
        );
      })}
    </Text>
  );
};

export default function Input({ value, onChange, textArray }: { value: Post; onChange: (id: string, key: string, value: string) => void, textArray: string[] }) {
  return (
    <>
          <View style={{ position: 'relative' }}>
      {/* Styled text layer */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          right: 12,
        }}
      >
        {renderText(textArray)}
      </View>

      {/* Real input */}
      <TextInput
        style={[
          styles.TextInput,
          { color: 'transparent' },
        ]}
        placeholder="State your opinion..."
        placeholderTextColor="gray"
        multiline
        value={value.text}
        onChangeText={(text) => onChange(value.id, 'text', text)}
      />
    </View>

    </>

    
    
  );
}

const styles = {
  TextInput: {
    color: 'white',
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
   textIfHash: {
    color: 'white',
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontWeight: 'bold' as const,
  },
  Text: {
    color: 'white',
    fontSize: 14,
  },
};


