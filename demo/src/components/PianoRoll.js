
import React from 'react'
import PropTypes from 'prop-types'
import * as d3 from 'd3'
import _ from 'lodash'
import MidiMessage from '../../../src/MidiMessage'

const init = function (el, {
  firstNote,
  nbrKeys,
  whiteKeyColor,
  blackKeyColor,
  pressedWhiteKeyColor,
  pressedBlackKeyColor,
  ...other
}) {
  const svg = d3.select(el)

  const isBlack = (nbr) => _.includes([1, 3, 6, 8, 10], nbr % 12)

  // draw white keys first
  const whites = _.range(firstNote, firstNote + nbrKeys).filter(el => !isBlack(el))
  const whiteWidth = 1 / whites.length
  const whiteXMargin = whiteWidth * 0.2
  const whiteTopMargin = 0.2

  whites.forEach((white, nbr) => {
    svg.append('rect')
      .attr('x', `${((nbr * whiteWidth) + whiteXMargin) * 100}%`)
      .attr('y', `${whiteTopMargin * 100}%`)
      .attr('width', `${(whiteWidth - (2 * whiteXMargin)) * 100}%`)
      .attr('height', `${(1 - whiteTopMargin) * 100}%`)
      .attr('fill', whiteKeyColor)
      .attr('rx', '10px')
      .attr('ry', '10px')
  })

  const blacks = _.range(firstNote, firstNote + nbrKeys).filter(el => isBlack(el))
  const blackWidthProp = 0.6
  const blackWidth = whiteWidth * blackWidthProp

  blacks.forEach((black, nbr) => {
    const nextWhiteNbr = whites.findIndex((x) => x > black)
    svg.append('rect')
      .attr('x', `${((nextWhiteNbr * whiteWidth) - (blackWidth / 2)) * 100}%`)
      .attr('y', 0)
      .attr('width', `${blackWidth * 100}%`)
      .attr('height', '60%')
      .attr('fill', blackKeyColor)
      .attr('rx', '10px')
      .attr('ry', '10px')
  })

  svg.node().coordsToNote = (x, y) => {
  }

  el.update = update
  el.update({
    ...other
  })
}

const update = function ({
}) {
  const svg = d3.select(this)
}

/**
 * Horizon Gauge
 */
export default class PianoRoll extends React.PureComponent {
  /**
   * @override
   */
  constructor (props) {
    super(props)
    this.elem = React.createRef()
    this.mouseDown = this.mouseDown.bind(this)
    this.mouseMove = this.mouseMove.bind(this)
    this.mouseUp = this.mouseUp.bind(this)
    this.touchStart = this.touchStart.bind(this)
    this.touchMove = this.touchMove.bind(this)
    this.touchEnd = this.touchEnd.bind(this)
  }

  /**
   * @override
   */
  componentDidMount () {
    this.elem.current.addEventListener('touchstart', this.touchStart, { passive: false })
    this.init()
  }

  componentWillUnmount () {
    window.removeEventListener('mousemove', this.mouseMove)
    window.removeEventListener('mouseup', this.mouseUp)
    window.removeEventListener('touchmove', this.touchMove)
    window.removeEventListener('touchend', this.touchEnd)
  }

  init () {
    this.elem.current.innerHTML = ''
    init(this.elem.current, this.props)
  }

  mouseDown (e) {
    e.preventDefault()
    window.addEventListener('mousemove', this.mouseMove)
    window.addEventListener('mouseup', this.mouseUp)
  }

  mouseMove (e) {
    e.preventDefault()
  }

  mouseUp (e) {
    window.removeEventListener('mousemove', this.mouseMove)
    window.removeEventListener('mouseup', this.mouseUp)
  }

  touchStart (e) {
    e.preventDefault()
    window.addEventListener('touchmove', this.touchMove)
    window.addEventListener('touchend', this.touchEnd)
  }

  touchMove (e) {
  }

  touchEnd (e) {
    window.removeEventListener('touchmove', this.touchMove)
    window.removeEventListener('touchend', this.touchEnd)
  }

  /**
   * @override
   */
  componentDidUpdate (prevProps) {
    const ignored = []
    const updatable = []

    const p = _.omit(prevProps, ignored)
    const n = _.omit(this.props, ignored)
    if (!_.isEqual(_.omit(p, updatable), _.omit(n, updatable))) {
      this.init()
    } else {
      this.elem.current.update(_.pick(n, updatable))
    }
  }

  /**
   * @override
   */
  render () {
    return (
      <svg ref={this.elem} style={this.props.style} className={this.props.className}
        onMouseDown={this.mouseDown}>
      </svg>
    )
  }
}

PianoRoll.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  firstNote: PropTypes.number,
  nbrKeys: PropTypes.number,
  whiteKeyColor: PropTypes.string,
  blackKeyColor: PropTypes.string,
  pressedWhiteKeyColor: PropTypes.string,
  pressedBlackKeyColor: PropTypes.string
}

PianoRoll.defaultProps = {
  firstNote: MidiMessage.nameToMidiNote('C2'),
  nbrKeys: (12 * 3) + 1,
  whiteKeyColor: '#adafae',
  blackKeyColor: '#2a9fd6',
  pressedWhiteKeyColor: '#999',
  pressedBlackKeyColor: '#444'
}
