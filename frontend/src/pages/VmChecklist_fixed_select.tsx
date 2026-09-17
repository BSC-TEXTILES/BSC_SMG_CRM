import React, { useState } from 'react';

interface VmChecklistFixedSelectProps {
  filterStatus?: string;
  setFilterStatus?: (val: string) => void;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}

export default function VmChecklistFixedSelect({
  filterStatus: propFilterStatus,
  setFilterStatus: propSetFilterStatus,
  value,
  onChange,
  className = "select-modern text-xs bg-white"
}: VmChecklistFixedSelectProps) {
  const [internalStatus, setInternalStatus] = useState<string>('All');

  const currentStatus = propFilterStatus ?? value ?? internalStatus;
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (propSetFilterStatus) {
      propSetFilterStatus(e.target.value);
    } else if (onChange) {
      onChange(e);
    } else {
      setInternalStatus(e.target.value);
    }
  };

  return (
    <select
      value={currentStatus}
      onChange={handleStatusChange}
      className={className}
    >
      <option value="All">All Statuses</option>
      <option value="Passed">Passed (100%)</option>
      <option value="Review">Review (80-99%)</option>
      <option value="Failed">Failed (&lt;80%)</option>
    </select>
  );
}
