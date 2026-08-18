import { useState } from 'react'
import { WILDLIFE_LEGEND } from '../../emblems/wildlifeEmblems.js'
import { TERRAIN_LEGEND } from '../../emblems/terrainColors.js'
import { ACTIVITY_LEGEND } from '../../emblems/activityEmblems.js'
import { FEATURE_ICONS, FEATURE_LABELS } from '../../data/seFeatures.js'
import styles from './MapLegend.module.css'

export function MapLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.toggle}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label="Map legend"
        type="button"
      >
        <span aria-hidden="true">{open ? '▼' : '▲'}</span> Legend
      </button>

      {open && (
        <div className={styles.panel} role="region" aria-label="Map legend">
          <div className={styles.section}>
            <h4 className={styles.heading}>Wildlife</h4>
            <div className={styles.emblems}>
              {WILDLIFE_LEGEND.map(({ group, label, svg }) => (
                <div key={group} className={styles.emblemItem}>
                  <span
                    className={styles.emblemIcon}
                    dangerouslySetInnerHTML={{ __html: svg }}
                    aria-hidden="true"
                  />
                  <span className={styles.emblemLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.heading}>Landscape</h4>
            <div className={styles.emblems}>
              {TERRAIN_LEGEND.map(({ id, label, color, svg }) => (
                <div key={id} className={styles.emblemItem}>
                  {svg ? (
                    <span
                      className={styles.emblemIcon}
                      style={{ color }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className={styles.terrainDot}
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className={styles.emblemLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.heading}>Campground Markers</h4>
            <div className={styles.markerKey}>
              <span className={styles.tentOrange} aria-hidden="true">⛺</span>
              <span className={styles.keyLabel}>Unselected</span>
              <span className={styles.tentGreen} aria-hidden="true">⛺</span>
              <span className={styles.keyLabel}>Selected</span>
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.heading}>Activities</h4>
            <div className={styles.emblems}>
              {ACTIVITY_LEGEND.map(({ id, label, svg }) => (
                <div key={id} className={styles.emblemItem}>
                  <span
                    className={styles.emblemIcon}
                    dangerouslySetInnerHTML={{ __html: svg }}
                    aria-hidden="true"
                  />
                  <span className={styles.emblemLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.heading}>Protected Lands</h4>
            <div className={styles.terrains}>
              {Object.entries(FEATURE_ICONS).map(([type, emoji]) => (
                <div key={type} className={styles.terrainItem}>
                  <span style={{ fontSize: 15 }} aria-hidden="true">{emoji}</span>
                  <span className={styles.terrainLabel}>{FEATURE_LABELS[type]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
