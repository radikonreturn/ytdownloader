import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

function App() {
  const [packages, setPackages] = useState([]);
  const [outdated, setOutdated] = useState({});
  const [loading, setLoading] = useState(false);
  const [filterOutdated, setFilterOutdated] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [logs, setLogs] = useState('');
  
  const logEndRef = useRef(null);

  useEffect(() => {
    fetchPackages();
    
    const unlistenPromise = listen('update-log', (event) => {
      setLogs((prev) => prev + event.payload + '\n');
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, []);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const fetchPackages = async () => {
    setLoading(true);
    setLogs((prev) => prev + '> Fetching global packages...\n');
    try {
      const pkgsStr = await invoke('get_global_packages');
      const pkgsData = JSON.parse(pkgsStr);
      const dependencies = pkgsData.dependencies || {};
      
      const pkgList = Object.keys(dependencies).map(name => ({
        name,
        version: dependencies[name].version
      }));
      setPackages(pkgList);
      
      setLogs((prev) => prev + '> Checking for outdated packages...\n');
      const outStr = await invoke('get_outdated_packages');
      const outData = JSON.parse(outStr);
      setOutdated(outData || {});
      
      setLogs((prev) => prev + '> Package list updated.\n');
    } catch (e) {
      setLogs((prev) => prev + `Error: ${e}\n`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(visiblePackages.map(p => p.name)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelect = (name) => {
    const next = new Set(selected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelected(next);
  };

  const updateSelected = async () => {
    if (selected.size === 0) return;
    const targets = Array.from(selected);
    await runUpdate(targets);
  };

  const updateAll = async () => {
    const targets = visiblePackages.map(p => p.name);
    if (targets.length === 0) return;
    await runUpdate(targets);
  };

  const runUpdate = async (targets) => {
    setLoading(true);
    setLogs((prev) => prev + `> npm install -g ${targets.join(' ')}\n`);
    try {
      await invoke('update_packages', { packages: targets });
      setLogs((prev) => prev + '> Update complete.\n');
      await fetchPackages();
    } catch (e) {
      setLogs((prev) => prev + `Error: ${e}\n`);
    } finally {
      setLoading(false);
    }
  };

  const visiblePackages = packages.filter(p => !filterOutdated || outdated[p.name]);

  return (
    <div className="app-container">
      <div className="left-pane">
        <div className="toolbar">
          <button onClick={fetchPackages} disabled={loading}>Refresh</button>
          <label>
            <input 
              type="checkbox" 
              checked={filterOutdated} 
              onChange={(e) => setFilterOutdated(e.target.checked)} 
            />
            Outdated Only
          </label>
          <div style={{ flex: 1 }}></div>
          <button onClick={updateSelected} disabled={loading || selected.size === 0}>
            Update Selected ({selected.size})
          </button>
          <button onClick={updateAll} disabled={loading || visiblePackages.length === 0} className="primary">
            Update All View
          </button>
        </div>
        
        <div className="package-list">
          {loading && packages.length === 0 ? (
            <div style={{ padding: '1rem' }}>Loading...</div>
          ) : (
            <>
              <div className="package-item" style={{ backgroundColor: 'transparent' }}>
                <label>
                  <input 
                    type="checkbox" 
                    checked={visiblePackages.length > 0 && selected.size === visiblePackages.length}
                    onChange={handleSelectAll}
                  />
                  <span>Select All</span>
                </label>
              </div>
              {visiblePackages.map(pkg => {
                const isOutdated = !!outdated[pkg.name];
                return (
                  <div key={pkg.name} className="package-item">
                    <label>
                      <input 
                        type="checkbox" 
                        checked={selected.has(pkg.name)}
                        onChange={() => handleSelect(pkg.name)}
                      />
                      <div className={`package-info ${isOutdated ? 'outdated' : ''}`}>
                        <div className="package-name">{pkg.name}</div>
                        <div className="package-version">
                          {pkg.version} 
                          {isOutdated && (
                            <>
                              {' '}→ <span className="latest-version">{outdated[pkg.name].latest}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      
      <div className="right-pane">
        <div className="terminal-log">
          {logs}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

export default App;
