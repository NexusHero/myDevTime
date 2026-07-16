/**
 * The myDevTime RN component library (issue #11) — the design system's components
 * ported to React Native / react-native-web, reading the resolved `Theme` off
 * `useTheme()` so every one is correct under all three accents × both modes
 * (ADR-0022). SVG-based instruments (BudgetRing, gauges, sparklines) land in a
 * later slice that adds react-native-svg.
 */
// Core
export { Text } from './core/Text'
export { Button } from './core/Button'
export { IconButton } from './core/IconButton'
export { Badge } from './core/Badge'
export { Card } from './core/Card'
export { Icon, type IconProps } from './core/Icon'
export { EmptyState } from './core/EmptyState'
export { ScreenScaffold } from './core/ScreenScaffold'
export { ScreenListScaffold } from './core/ScreenListScaffold'
export { AICallout } from './core/AICallout'
export { AIAskBar } from './core/AIAskBar'
export { ReanimatedTimer, type ReanimatedTimerProps } from './ReanimatedTimer'

// Forms
export { Input } from './forms/Input'
export { Switch } from './forms/Switch'
export { Checkbox } from './forms/Checkbox'
export { Select, type SelectOption } from './forms/Select'
export { SegmentedControl } from './forms/SegmentedControl'

// Navigation
export { Tabs, type TabItem } from './navigation/Tabs'

// Canvas
export { DayBlock } from './canvas/DayBlock'
export { Island, type IslandAction } from './canvas/Island'
export { LiveButton } from './canvas/LiveButton'
export { LiveMark, type LiveMarkState } from './canvas/LiveMark'
export { Sevi, type SeviMood } from './canvas/Sevi'
export { Blocky, type BlockyVariant } from './canvas/Blocky'
export { BrandSplash, hasPlayedSplash } from './canvas/BrandSplash'
export { PauseCounter } from './canvas/PauseCounter'
export { OverflowShelf, type OverflowItem } from './canvas/OverflowShelf'

// Data
export { ProgressBar } from './data/ProgressBar'
export { Row } from './data/Row'
export { BudgetRing } from './data/BudgetRing'
export { Gauge } from './data/Gauge'
export { Sparkline } from './data/Sparkline'
export { StatTile } from './data/StatTile'
export { WeekSparkline } from './data/WeekSparkline'

// Instruments
export { MoodCheck } from './instruments/MoodCheck'
export { CheckinCard } from './instruments/CheckinCard'
export { LoadMeter } from './instruments/LoadMeter'
export { LeaveBalance } from './instruments/LeaveBalance'
export { BoxPlot } from './instruments/BoxPlot'
export { Heatmap } from './instruments/Heatmap'
export { OvertimeGauge } from './instruments/OvertimeGauge'
