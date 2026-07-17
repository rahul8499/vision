import gluestackPlugin from "@gluestack-ui/nativewind-utils/tailwind-plugin";

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: ["app/**/*.{tsx,jsx,ts,js}", "components/**/*.{tsx,jsx,ts,js}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        roboto: ["Roboto_400Regular"],
        robotoMedium: ["Roboto_500Medium"],
        robotoBold: ["Roboto_700Bold"],

      },
      colors: {
        emerald: {
          500: "#10B981",   // Use for button background
          700: "#047857",   // Use for icon or title text
        },
      gray: {
          700: "#374151",   // For dark body text
          500: "#6B7280",   // For lighter subtext
        }
      }

    },
  },
  plugins: [gluestackPlugin],
};
