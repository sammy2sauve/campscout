import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useApp } from '../../context/AppContext.jsx'
import { WILDLIFE_TAGS, LANDSCAPE_TAGS, ACTIVITY_TAGS } from '../../constants/tags.js'
import { WILDLIFE_LEGEND, getWildlifeIcon, primaryWildlifeGroup } from '../../emblems/wildlifeEmblems.js'
import { TERRAIN_LEGEND } from '../../emblems/terrainColors.js'
import { ACTIVITY_LEGEND, ACTIVITY_TYPES } from '../../emblems/activityEmblems.js'
import styles from './FilterPanel.module.css'

const AMENITY_FILTERS = [
  { key: 'has_electricity', label: 'Electricity' },
  { key: 'has_showers', label: 'Showers' },
  { key: 'has_toilets', label: 'Flush Toilets' },
  { key: 'has_drinking_water', label: 'Drinking Water' },
  { key: 'pets_allowed', label: 'Dog Friendly' },
]

export function FilterPanel({ open = true }) {
  const { filters, setFilter, toggleTag, clearFilters } = useApp()
  const panelClass = [styles.panel, open ? styles.open : ''].filter(Boolean).join(' ')

  return (
    <aside className={panelClass}>
      <div className={styles.panelHandle} aria-hidden="true" />
      <div className={styles.header}>
        <span className={styles.title}>Filters</span>
        <button className={styles.clearBtn} onClick={clearFilters}>Clear all</button>
      </div>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Amenities</h3>
        {AMENITY_FILTERS.map(({ key, label }) => (
          <label key={key} className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={(e) => setFilter(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Availability Window</h3>
        <div className={styles.datePickers}>
          <DatePicker
            selected={filters.availStart}
            onChange={(d) => setFilter('availStart', d)}
            selectsStart
            startDate={filters.availStart}
            endDate={filters.availEnd}
            minDate={new Date()}
            placeholderText="From"
            className={styles.dateInput}
            popperPlacement="bottom-start"
          />
          <DatePicker
            selected={filters.availEnd}
            onChange={(d) => setFilter('availEnd', d)}
            selectsEnd
            startDate={filters.availStart}
            endDate={filters.availEnd}
            minDate={filters.availStart || new Date()}
            placeholderText="To"
            className={styles.dateInput}
            popperPlacement="bottom-start"
          />
        </div>
      </section>

      {/* ── Wildlife ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Wildlife</h3>
        <div className={styles.emblemGrid}>
          {WILDLIFE_LEGEND.map(({ group, label, svg }) => {
            const tagsInGroup = WILDLIFE_TAGS.filter(
              t => (primaryWildlifeGroup([t]) ?? 'other') === group
            )
            const anyActive = tagsInGroup.some(t => filters.wildlife_tags.includes(t))
            return (
              <button
                key={group}
                className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                onClick={() => tagsInGroup.forEach(t => {
                  if (anyActive ? filters.wildlife_tags.includes(t) : !filters.wildlife_tags.includes(t)) {
                    toggleTag('wildlife_tags', t)
                  }
                })}
                type="button"
                aria-pressed={anyActive}
                title={label}
              >
                <span
                  className={styles.emblemIcon}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  aria-hidden="true"
                />
                <span className={styles.emblemLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Landscape ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Landscape</h3>
        <div className={styles.emblemGrid3}>
          {TERRAIN_LEGEND.map(({ id, label, color, svg, keywords }) => {
            const tagsInGroup = LANDSCAPE_TAGS.filter(t => keywords.includes(t.toLowerCase()))
            const anyActive = tagsInGroup.some(t => filters.terrain_tags.includes(t))
            return (
              <button
                key={id}
                className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                onClick={() => tagsInGroup.forEach(t => {
                  if (anyActive ? filters.terrain_tags.includes(t) : !filters.terrain_tags.includes(t)) {
                    toggleTag('terrain_tags', t)
                  }
                })}
                type="button"
                aria-pressed={anyActive}
                title={label}
                style={{ '--emblem-color': color }}
              >
                <span
                  className={styles.emblemIcon}
                  style={{ color: anyActive ? color : undefined }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  aria-hidden="true"
                />
                <span className={styles.emblemLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Activities ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Activities</h3>
        <div className={styles.emblemGrid3}>
          {ACTIVITY_LEGEND.map(({ id, label, svg, keywords }) => {
            const tagsInGroup = ACTIVITY_TAGS.filter(t => keywords.includes(t.toLowerCase()))
            const anyActive = tagsInGroup.some(t => filters.activity_tags.includes(t))
            return (
              <button
                key={id}
                className={`${styles.emblemBtn} ${anyActive ? styles.emblemActive : ''}`}
                onClick={() => tagsInGroup.forEach(t => {
                  if (anyActive ? filters.activity_tags.includes(t) : !filters.activity_tags.includes(t)) {
                    toggleTag('activity_tags', t)
                  }
                })}
                type="button"
                aria-pressed={anyActive}
                title={label}
              >
                <span
                  className={styles.emblemIcon}
                  dangerouslySetInnerHTML={{ __html: svg }}
                  aria-hidden="true"
                />
                <span className={styles.emblemLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </section>
    </aside>
  )
}
