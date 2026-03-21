import React from 'react';
import { Outlet } from 'react-router-dom';
import DirectorSubNav from '../../components/director-panel/DirectorSubNav';

export default function DirectorLayout() {
  return (
    <>
      <DirectorSubNav />
      <Outlet />
    </>
  );
}
