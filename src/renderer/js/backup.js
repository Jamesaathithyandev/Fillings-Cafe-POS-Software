// Sree Sai Fillings Cafe - Backup & Excel Synchronization Controller

const BackupController = {
  init() {
    this.bindEvents();
  },

  async refresh() {
    await Promise.all([
      this.loadGoogleSheetsInfo(),
      this.loadExcelInfo(),
      this.loadBackupsList(),
      this.loadCloudInfo()
    ]);
  },

  bindEvents() {
    // Google Sheets Live Sync Buttons
    const btnSaveSheets = document.getElementById('btn-save-sheets-config');
    if (btnSaveSheets) {
      btnSaveSheets.addEventListener('click', async () => {
        const webAppUrl = (document.getElementById('input-sheets-webapp-url')?.value || '').trim();
        const sheetUrl = (document.getElementById('input-sheets-doc-url')?.value || '').trim();

        if (!webAppUrl) {
          App.showToast('Please enter your Google Apps Script Web App URL first.', 'warning');
          return;
        }

        btnSaveSheets.disabled = true;
        btnSaveSheets.textContent = 'Testing Connection...';

        try {
          await window.electronAPI.saveGoogleSheetsConfig({
            webAppUrl,
            sheetUrl,
            enabled: true
          });

          const testRes = await window.electronAPI.testGoogleSheetsConnection();
          if (testRes && testRes.success) {
            App.showToast('✅ Google Sheets Live Sync Connected successfully!', 'success');
          } else {
            App.showToast(`Saved, but test connection returned: ${testRes ? testRes.message : 'Timeout'}`, 'warning');
          }
        } catch (err) {
          App.showToast(`Config error: ${err.message}`, 'error');
        } finally {
          btnSaveSheets.disabled = false;
          btnSaveSheets.innerHTML = '<svg><use href="#icon-save"/></svg> Save &amp; Test Connection';
          await this.loadGoogleSheetsInfo();
        }
      });
    }

    const btnSyncSheets = document.getElementById('btn-sync-sheets-now');
    if (btnSyncSheets) {
      btnSyncSheets.addEventListener('click', async () => {
        btnSyncSheets.disabled = true;
        btnSyncSheets.innerHTML = '<span class="pulse-dot warn" style="display:inline-block; margin-right:6px;"></span> Syncing...';
        App.showToast('Uploading full business database across all 7 Google Sheets...', 'info');

        try {
          const res = await window.electronAPI.syncGoogleSheetsNow();
          if (res && res.success) {
            App.showToast(res.message || '✅ All 7 Google Sheets synchronized live!', 'success');
          } else {
            App.showToast(res ? res.message : 'Google Sheets sync failed. Please verify Web App URL.', 'warning');
          }
        } catch (err) {
          App.showToast('Google Sheets sync error: ' + err.message, 'error');
        } finally {
          btnSyncSheets.disabled = false;
          btnSyncSheets.innerHTML = '<svg><use href="#icon-sync"/></svg> Sync All 7 Sheets Now';
          await this.loadGoogleSheetsInfo();
        }
      });
    }

    const btnOpenSheetsBrowser = document.getElementById('btn-open-sheets-browser');
    if (btnOpenSheetsBrowser) {
      btnOpenSheetsBrowser.addEventListener('click', async () => {
        const res = await window.electronAPI.openGoogleSheet();
        if (!res || !res.success) {
          App.showToast('Please enter your Google Spreadsheet View Link and click Save first.', 'info');
        }
      });
    }

    // 0. Update Cloud Data Button (Smart Offline Delta Push)
    const btnUpdateCloud = document.getElementById('btn-update-cloud-data');
    if (btnUpdateCloud) {
      btnUpdateCloud.addEventListener('click', async () => {
        btnUpdateCloud.disabled = true;
        btnUpdateCloud.innerHTML = '<span class="pulse-dot warn" style="display:inline-block; margin-right:6px;"></span> Updating Cloud...';
        await App.updateCloudData(false);
        await this.loadCloudInfo();
        btnUpdateCloud.disabled = false;
        btnUpdateCloud.innerHTML = '<svg><use href="#icon-sync"/></svg> Update Cloud Data';
      });
    }

    // 1. Manual Sync Excel Button
    const btnSync = document.getElementById('btn-manual-sync-excel');
    if (btnSync) {
      btnSync.addEventListener('click', async () => {
        App.showToast('Synchronizing Business_Data.xlsx...', 'info');
        const res = await window.electronAPI.syncExcel();
        if (res.success) {
          App.showToast('Excel workbook synchronized successfully!', 'success');
        } else {
          App.showToast(res.message, 'warning');
        }
        await this.loadExcelInfo();
        App.checkExcelStatus();
      });
    }

    // 2. Custom Excel Export Button
    const btnExportCustom = document.getElementById('btn-export-excel-custom');
    if (btnExportCustom) {
      btnExportCustom.addEventListener('click', async () => {
        const res = await window.electronAPI.exportExcelDialog();
        if (res.success) {
          App.showToast('Excel file exported successfully!', 'success');
        } else if (res.message) {
          App.showToast(res.message, 'warning');
        }
      });
    }

    // 3. Create Full DB Backup Button
    const btnCreateBackup = document.getElementById('btn-create-db-backup');
    if (btnCreateBackup) {
      btnCreateBackup.addEventListener('click', async () => {
        App.showToast('Creating database snapshot backup...', 'info');
        try {
          const res = await window.electronAPI.createBackup();
          if (res.success) {
            App.showToast(res.message, 'success');
            await this.loadBackupsList();
          }
        } catch (err) {
          App.showToast(`Backup failed: ${err.message}`, 'error');
        }
      });
    }

    // 4. Restore DB Backup Button
    const btnRestoreBackup = document.getElementById('btn-restore-db-backup');
    if (btnRestoreBackup) {
      btnRestoreBackup.addEventListener('click', async () => {
        if (!confirm('WARNING: Restoring a backup will replace current database records with the backup file data. Do you want to proceed?')) {
          return;
        }

        try {
          const res = await window.electronAPI.selectAndRestoreBackup();
          if (res.success) {
            App.showToast(res.message, 'success');
            await this.loadBackupsList();
            if (window.DashboardController) window.DashboardController.refresh();
          } else if (res.message) {
            App.showToast(res.message, 'info');
          }
        } catch (err) {
          App.showToast(`Restore failed: ${err.message}`, 'error');
        }
      });
    }
  },

  async loadExcelInfo() {
    try {
      const status = await window.electronAPI.getExcelStatus();
      const pathEl = document.getElementById('backup-excel-path');
      const timeEl = document.getElementById('backup-excel-last-sync');
      const statusEl = document.getElementById('backup-excel-status');

      if (pathEl) pathEl.textContent = status.filePath || 'Business_Data.xlsx';
      if (timeEl) {
        timeEl.textContent = status.lastSyncTime ? new Date(status.lastSyncTime).toLocaleString('en-IN') : 'Synchronized on start';
      }
      if (statusEl) {
        if (status.locked) {
          statusEl.textContent = 'File Locked (Open in Excel)';
          statusEl.style.color = 'var(--warning)';
        } else if (status.success) {
          statusEl.textContent = 'Active & Synchronized';
          statusEl.style.color = 'var(--success)';
        } else {
          statusEl.textContent = 'Sync Pending';
          statusEl.style.color = 'var(--warning)';
        }
      }
    } catch (e) {
      console.warn('Excel info error:', e);
    }
  },

  async loadCloudInfo() {
    try {
      const statusEl = document.getElementById('backup-cloud-status');
      const pendingEl = document.getElementById('backup-cloud-pending');

      if (window.electronAPI && window.electronAPI.getPendingCloudCount) {
        const info = await window.electronAPI.getPendingCloudCount();
        if (statusEl) {
          statusEl.textContent = info.connected ? 'Online' : 'Offline';
          statusEl.style.color = info.connected ? 'var(--success)' : 'var(--text-muted)';
        }
        if (pendingEl) {
          if (!info.connected) {
            pendingEl.textContent = 'Offline (Click Update to reconnect)';
            pendingEl.style.color = 'var(--warning)';
          } else if (info.pendingTotal === 0) {
            pendingEl.textContent = '0 pending (All Synced)';
            pendingEl.style.color = 'var(--success)';
          } else {
            const parts = [];
            if (info.pendingOrd > 0) parts.push(`${info.pendingOrd} order(s)`);
            if (info.pendingCust > 0) parts.push(`${info.pendingCust} customer(s)`);
            if (info.pendingExp > 0) parts.push(`${info.pendingExp} expense(s)`);
            pendingEl.textContent = `${info.pendingTotal} waiting: ${parts.join(', ')}`;
            pendingEl.style.color = 'var(--amber-400)';
          }
        }
      }
    } catch (e) {
      console.warn('Cloud info error:', e);
    }
  },

  async loadBackupsList() {
    const tbody = document.getElementById('backups-table-body');
    if (!tbody) return;

    try {
      const backups = await window.electronAPI.listBackups();
      if (!backups || backups.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center; padding:24px; color:var(--text-muted);">
              No database backups created yet. Click "+ CREATE FULL BACKUP NOW" above to create one.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = backups.map(b => `
        <tr>
          <td><strong style="color:var(--text-amber);">${b.filename}</strong></td>
          <td>${b.formattedDate}</td>
          <td>${(b.sizeBytes / 1024).toFixed(1)} KB</td>
          <td style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">${b.path}</td>
        </tr>
      `).join('');

    } catch (e) {
      console.warn('Backups list error:', e);
    }
  },

  async loadGoogleSheetsInfo() {
    try {
      if (!window.electronAPI || !window.electronAPI.getGoogleSheetsStatus) return;
      const status = await window.electronAPI.getGoogleSheetsStatus();

      const inputWebApp = document.getElementById('input-sheets-webapp-url');
      const inputDoc = document.getElementById('input-sheets-doc-url');
      const dotEl = document.getElementById('sheets-status-dot');
      const textEl = document.getElementById('sheets-status-text');
      const syncEl = document.getElementById('sheets-last-sync');
      const badgeEl = document.getElementById('sheets-badge-status');

      // Sidebar chip
      const sideDot = document.getElementById('sheets-sync-dot');
      const sideText = document.getElementById('sheets-sync-text');

      if (inputWebApp && !inputWebApp.value && status.webAppUrl) {
        inputWebApp.value = status.webAppUrl;
      }
      if (inputDoc && !inputDoc.value && status.sheetUrl) {
        inputDoc.value = status.sheetUrl;
      }

      if (status.ready) {
        if (dotEl) dotEl.style.background = '#10B981';
        if (textEl) {
          textEl.textContent = 'Live Real-Time Sync Active';
          textEl.style.color = '#10B981';
        }
        if (badgeEl) {
          badgeEl.textContent = 'Live Connected';
          badgeEl.style.background = 'rgba(16,185,129,0.2)';
          badgeEl.style.color = '#10B981';
        }
        if (sideDot) sideDot.style.background = '#10B981';
        if (sideText) sideText.textContent = 'Live Sheets OK';
      } else if (status.webAppUrl) {
        if (dotEl) dotEl.style.background = '#F59E0B';
        if (textEl) {
          textEl.textContent = 'Configured (Testing Needed)';
          textEl.style.color = 'var(--warning)';
        }
        if (badgeEl) {
          badgeEl.textContent = 'Configured';
          badgeEl.style.background = 'rgba(245,158,11,0.2)';
          badgeEl.style.color = 'var(--warning)';
        }
        if (sideDot) sideDot.style.background = '#F59E0B';
        if (sideText) sideText.textContent = 'Sheets Pending';
      } else {
        if (dotEl) dotEl.style.background = '#9CA3AF';
        if (textEl) {
          textEl.textContent = 'Not Configured (Paste URL to activate)';
          textEl.style.color = 'var(--text-muted)';
        }
        if (badgeEl) {
          badgeEl.textContent = 'Setup Needed';
          badgeEl.style.background = 'rgba(156,163,175,0.2)';
          badgeEl.style.color = 'var(--text-muted)';
        }
        if (sideDot) sideDot.style.background = '#9CA3AF';
        if (sideText) sideText.textContent = 'Google Sheet';
      }

      if (syncEl) {
        syncEl.textContent = status.lastSync ? new Date(status.lastSync).toLocaleString('en-IN') : 'Never';
      }
    } catch (e) {
      console.warn('Google Sheets info error:', e);
    }
  }
};

window.BackupController = BackupController;
document.addEventListener('DOMContentLoaded', () => {
  BackupController.init();
});
