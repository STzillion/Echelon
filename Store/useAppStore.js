import { create } from "zustand";

export const useAppStore = create((set) => ({
  imageSelected: false,                 //store global variable to be used across components
  setImageSelected: (value) => set({    
    imageSelected: value,
  }),
}));

//Sidenote: This file creates a global state using Zustand to manage where variables can be accessed across different components in the application.
//Came in handy lol!
