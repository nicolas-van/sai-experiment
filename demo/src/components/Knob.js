
import React from 'react'
import PropTypes from 'prop-types'
import * as d3 from 'd3'
import _ from 'lodash'

const rotateMax = 150
const rotateScale = d3.scaleLinear([-1, 1], [-1 * rotateMax, rotateMax])

const init = function (el, {
  ...other
}) {
  const svg = d3.select(el)
    .attr('viewBox', [-1, -1, 2, 2])

  const g = svg.append('g')
    .classed('knob-rotating', true)

  g.append('circle')
    .classed('knob-big-circle', true)
    .attr('cx', 0)
    .attr('cy', 0)
    .attr('r', 1)

  const spotWidth = 0.07

  g.append('rect')
    .classed('knob-little-spot', true)
    .attr('x', -spotWidth / 2)
    .attr('y', -0.8)
    .attr('width', spotWidth)
    .attr('height', 0.5)

  el.update = update
  el.update({
    ...other
  })
}

const update = function ({
  primaryColor,
  secondaryColor,
  value
}) {
  const svg = d3.select(this)
  svg.node().dataset.value = value
  svg.select('.knob-rotating')
    .attr('transform', `rotate(${rotateScale(value)})`)

  svg.select('.knob-big-circle')
    .attr('fill', primaryColor)

  svg.select('.knob-little-spot')
    .attr('fill', secondaryColor)
}

/**
 * Horizon Gauge
 */
export default class Knob extends React.PureComponent {
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
    this._initialValue = this.props.value
    this._initialX = e.screenX
    this._initialY = e.screenY
    window.addEventListener('mousemove', this.mouseMove)
    window.addEventListener('mouseup', this.mouseUp)
  }

  mouseMove (e) {
    e.preventDefault()
    const diff = e.screenX - this._initialX
    const scaler = d3.scaleLinear([0, 100], [0, 1])
    this.props.onValueChange(_.clamp(this._initialValue + scaler(diff), -1, 1))
  }

  mouseUp (e) {
    window.removeEventListener('mousemove', this.mouseMove)
    window.removeEventListener('mouseup', this.mouseUp)
  }

  touchStart (e) {
    e.preventDefault()
    this._initialValue = this.props.value
    const touch = e.changedTouches[0]
    this._initialX = touch.screenX
    this._initialY = touch.screenY
    this._touchEvent = touch.identifier
    window.addEventListener('touchmove', this.touchMove)
    window.addEventListener('touchend', this.touchEnd)
  }

  touchMove (e) {
    const touch = _.find(e.changedTouches, (t) => t.identifier === this._touchEvent)
    if (!touch) {
      return
    }
    const diff = touch.screenX - this._initialX
    const scaler = d3.scaleLinear([0, 100], [0, 1])
    this.props.onValueChange(_.clamp(this._initialValue + scaler(diff), -1, 1))
  }

  touchEnd (e) {
    window.removeEventListener('touchmove', this.touchMove)
    window.removeEventListener('touchend', this.touchEnd)
  }

  /**
   * @override
   */
  componentDidUpdate (prevProps) {
    const ignored = ['onValueChange']
    const updatable = ['value', 'primaryColor', 'secondaryColor']

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

Knob.propTypes = {
  style: PropTypes.object,
  className: PropTypes.string,
  primaryColor: PropTypes.string,
  secondaryColor: PropTypes.string,
  value: PropTypes.number,
  onValueChange: PropTypes.func
}

Knob.defaultProps = {
  primaryColor: '#2a9fd6',
  secondaryColor: '#fff',
  value: 0,
  onValueChange: () => {}
}
