import React from 'react';
import { createRoot } from 'react-dom/client';
import { Sandpack } from '@codesandbox/sandpack-react';
import deps from '../deps.json';
import files from './files.js';

createRoot(document.getElementById('root')).render(
  <Sandpack
    template="react"
    files={files}
    customSetup={{ dependencies: deps }}
    options={{
      bundlerURL: 'http://localhost:4587',
      showOpenInCodeSandbox: false,
      showTabs: true,
      showLineNumbers: true,
      editorHeight: '95vh',
      recompileMode: 'delayed',
      recompileDelay: 500,
    }}
    theme="dark"
  />
);
