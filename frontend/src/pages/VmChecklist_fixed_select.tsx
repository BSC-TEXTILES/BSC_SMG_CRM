<select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-modern text-xs bg-white">
                <option value="All">All Statuses</option>
                <option value="Passed">Passed (100%)</option>
                <option value="Review">Review (80-99%)</option>
                <option value="Failed">Failed (<80%)</option>
              </select>