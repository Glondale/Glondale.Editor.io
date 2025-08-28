 
import App from './App.js';

const { StrictMode, createElement } = React;
const { createRoot } = ReactDOM;

createRoot(document.getElementById('root')).render(
  createElement(StrictMode, {}, createElement(App))
);