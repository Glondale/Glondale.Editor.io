 
import App from './App.js';

import React, { StrictMode, createElement } from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";
const { createRoot } = ReactDOM;

createRoot(document.getElementById('root')).render(
  createElement(StrictMode, {}, createElement(App))
);