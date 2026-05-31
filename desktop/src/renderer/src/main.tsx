import './setupMonaco';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/jetbrains-mono';
import 'react-mosaic-component/react-mosaic-component.css';
import '@xterm/xterm/css/xterm.css';
import './styles.css';
import App from './App';

// Platforma özgü pencere kabuğu (mac'te yerel trafik ışıkları için boşluk).
if (window.asoterm?.platform === 'darwin') {
  document.documentElement.classList.add('is-mac');
}

createRoot(document.getElementById('root')!).render(<App />);
