import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { useApp } from '../../context/AppContext.jsx'
import { TagPill } from '../shared/TagPill.jsx'
import { WILDLIFE_TAGS, TERRAIN_TAGS } from '../../constants/tags.js'
import styles from './FilterPanel.module.css'

const AMENITY_FILTERS = [
  { key: 'has_electricity', label: 'Electricity' },
  { key: 'has_showers', label: 'Showers' },
  { key: 'has_toilets', label: 'Flush Toilets' },
  { key: 'has_drinking_water', label: 'Drinking Water' },
  { key: 'pets_allowed', label: 'Dog Friendly' },
]

export function FilterPanel() {
  const { filters, setFilter, toggleTag, clearFilters } = useApp()

  return (
    <aside className={styles.panel}>
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

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Wildlife</h3>
        <div className={styles.pills}>
          {WILDLIFE_TAGS.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              active={filters.wildlife_tags.includes(tag)}
              onClick={() => toggleTag('wildlife_tags', tag)}
            />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Terrain</h3>
        <div className={styles.pills}>
          {TERRAIN_TAGS.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              active={filters.terrain_tags.includes(tag)}
              onClick={() => toggleTag('terrain_tags', tag)}
            />
          ))}
        </div>
      </section>
    </aside>
  )
}
