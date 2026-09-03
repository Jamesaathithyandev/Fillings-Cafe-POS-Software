// Sree Sai Fillings Cafe - Backup & Excel Synchronization Controller

const BackupController = {
  init() {
    this.bindEvents();
  },

  async refresh() {
    await Promise.all([
      this.loadExcelInfo(),
      this.loadBackupsList()
    ]);
  },

  bindEvents() {
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
  }
};

window.BackupController = BackupController;
document.addEventListener('DOMContentLoaded', () => {
  BackupController.init();
});
