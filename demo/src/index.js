
// import some polyfill to ensure everything works OK
import 'core-js/stable'
import 'regenerator-runtime/runtime'

// import bootstrap's javascript part
import 'bootstrap'

// import font awesome fonts
import '@fortawesome/fontawesome-free/css/all.css'

import React from 'react'
import ReactDOM from 'react-dom'

import App from './App'

ReactDOM.render(
  <App/>,
  document.getElementById('root')
)
