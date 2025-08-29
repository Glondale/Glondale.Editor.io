 
import App from './App.js';

import React, { StrictMode, createElement } from "https://esm.sh/react@18";
const { createRoot } = ReactDOM;

createRoot(document.getElementById('root')).render(
  createElement(StrictMode, {}, createElement(App))
);