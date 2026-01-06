import React from "react";
import { TextInput } from "react-native";
import { Text } from "@/components/ui/text";
import { Post } from "@/providers/PostsProvider";

const renderText = (text: string) => {
 const regex = /(#\w+)|(@\w+)/g;
 const parts = text?.match(regex);

 return(
    <Text className="my-2">
        {parts?.map((part, index) => {
            if(part.startsWith('#')){
               const tag = part?.toUpperCase()
               return (<Text size="md" key={index} className="font-bold">{tag} </Text>
               )
            } else{
                return (<Text size="md" key={index}>{part} </Text>
                )
            }
        })}
    </Text>
 )}

 export default({post, updatePost}: {post: Post, updatePost: (id: string, text: string, value: string) => void}) => {
    return(
        <TextInput
           className= "text-lg"
           placeholder="Defend your opinion"
           multiline={true}
           value={post.text}
           onChangeText={(text) => updatePost(post.id, 'text', text)}
           onContentSizeChange={(e)=> console.log(e.nativeEvent.contentSize.height)}
           onKeyPress={({nativeEvent})=>{
            console.log(nativeEvent.key)
           }}
        >
            {renderText(post.text)}
            <Text>{post?.text}</Text>
        </TextInput>
    );
 }
