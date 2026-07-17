// import React, { ReactNode, createContext, useContext, useState } from 'react';

// type SignupProviderProps = {
//   children: ReactNode;
// };

// type SignupData = {
//   name: string;
//   ownerName: string;
//   mobile: string;
//   email: string;
//   address: string;
//   pincode: string;
//   gstNumber: string;
//   drugLicense: string;
//   password: any

// };

// type SignupContextType = {
//   signupData: SignupData;
//   setSignupData: React.Dispatch<React.SetStateAction<SignupData>>;
// };

// const SignupContext = createContext<SignupContextType | undefined>(undefined);

// export const SignupProvider = ({ children }: SignupProviderProps) => {
//   const [signupData, setSignupData] = useState<SignupData>({
//     name: '',
//     ownerName: '',
//     mobile: '',
//     email: '',
//     address: '',
//     pincode: '',
//     gstNumber: '',
//     drugLicense: '',
//     password: '',

//   });

//   return (
//     <SignupContext.Provider value={{ signupData, setSignupData }}>
//       {children}
//     </SignupContext.Provider>
//   );
// };

// export const useSignup = () => {
//   const context = useContext(SignupContext);
//   if (context === undefined) {
//     throw new Error('useSignup must be used within a SignupProvider');
//   }
//   return context;
// };
import React, { createContext, ReactNode, useContext, useState } from 'react';

type SignupProviderProps = {
  children: ReactNode;
};

type CommonSignupData = {
  name: string;
  mobile: string;
  email: string;
  password: string;
  address?: string;
  pincode?: string;
  latitude?: string;
  longitude?: string;
};

type StoreSpecificData = {
  ownerName?: string;
  gstNumber?: string;
  drugLicense?: string;
};

type SignupData = CommonSignupData & StoreSpecificData;

type SignupContextType = {
  signupData: SignupData;
  setSignupData: React.Dispatch<React.SetStateAction<SignupData>>;
};

const SignupContext = createContext<SignupContextType | undefined>(undefined);

export const SignupProvider = ({ children }: SignupProviderProps) => {
  const [signupData, setSignupData] = useState<SignupData>({
    name: '',
    mobile: '',
    email: '',
    password: '',
    // Optional store fields
    ownerName: '',
    address: '',
    pincode: '',
    latitude: '',
    longitude: '',
    gstNumber: '',
    drugLicense: '',
  });

  return (
    <SignupContext.Provider value={{ signupData, setSignupData }}>
      {children}
    </SignupContext.Provider>
  );
};

export const useSignup = () => {
  const context = useContext(SignupContext);
  if (!context) {
    throw new Error('useSignup must be used within a SignupProvider');
  }
  return context;
};
