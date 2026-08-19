import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";
import { router } from "expo-router";
import React from "react";

export const AuthContext = React.createContext({
    user: {},
    setUser: ({}) => {},
    logOut: () => {},
    createUser: (username: string) => { },
});

export const  useAuth = () => React.useContext(AuthContext);

export const AuthProvider = ({children}: {children: React.ReactNode}) =>{
    const  [user, setUser] = React.useState({});
    const [session, setSession] = React.useState<Session | null>(null)

   const createUser = async (username: string) => {
      if (!session?.user?.id) {
        console.error("No session user ID yet — try again later");
        return;
      }

      const { data, error } = await supabase.from("User").insert({
        id: session.user.id,
        username,
      }).select();

      if (error) return console.error(error);
      setUser(data[0]);

      router.replace('/(tabs)')
    };


    const logOut = async () =>
    {
        await supabase.auth.signOut();
        router.replace('/(auth)')
        console.log("signed out ")
    }



    React.useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    routeBySession(session);
  });

  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    routeBySession(session);
  });

  return () => { sub?.subscription?.unsubscribe?.(); };
}, []);


const hasRoutedRef = React.useRef(false);

const routeBySession = async (session: Session | null) => {
  if (hasRoutedRef.current) return; // debounce multiple auth events
  if (!session) {

    return;
  }

  
  const { data, error } = await supabase
    .from('User')
    .select('id, username, avatar')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.log('getUser error:', error);
    return; 
  }

  if (data) {
    setUser(data);
    hasRoutedRef.current = true;
    router.replace('/(tabs)');
  } 
  else
  {
    
    hasRoutedRef.current = true;
    router.replace('/(auth)/username');
  }
};

    return(
        <AuthContext.Provider value={{user, setUser, logOut, createUser,}}>
            {children}
        </AuthContext.Provider>
    )
}