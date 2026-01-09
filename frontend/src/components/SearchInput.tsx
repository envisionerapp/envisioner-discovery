import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

export const SearchInput: React.FC<Props> = ({ containerClassName, className, ...props }) => {
  return (
    <div className={`relative ${containerClassName || ''}`}>
      <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none" />
      <input
        type="search"
        className={`form-input pl-10 w-full ${className || ''}`}
        style={{ height: '38px' }}
        {...props}
      />
    </div>
  );
};
