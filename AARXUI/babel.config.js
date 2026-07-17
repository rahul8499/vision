// module.exports = function(api) {
//   api.cache(true);

//   return {
//       presets: [["babel-preset-expo", {
//           jsxImportSource: "nativewind"
//       }], "nativewind/babel"],

//       plugins: [["module-resolver", {
//           root: ["./"],

//           alias: {
//               "@": "./",
//               "tailwind.config": "./tailwind.config.js"
//           }
//       }],
//           "react-native-reanimated/plugin",
// ]
//   };
// };


module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
            "tailwind.config": "./tailwind.config.js",
          },
        },
      ],
      // 👇 This must be last
      "react-native-reanimated/plugin",
    ],
  };
};
