/*
global
CodeMirror: false
settings: true
Dropzone: false
*/

import {
  call,
  configureNamespace,
  editors,
  jsonEditors,
  notify,
  openPanel,
  processInstance,
  showInstancePanel,
} from "./base.js";
import { refreshTable, tables, tableInstances } from "./table.js";

export const defaultFolder = settings.paths.file || `${applicationPath}/files`;
export let folderPath = localStorage.getItem("folderPath") || defaultFolder;

function displayFiles() {
  if (tableInstances["file"]) return notify("The files table is already displayed.", "error", 5);
  openPanel({
    name: "files",
    size: "1000 600",
    content: `
      <form id="search-form-file" style="margin: 15px">
        <div id="tooltip-overlay" class="overlay"></div>
        <nav
          id="controls-file"
          class="navbar navbar-default nav-controls"
          role="navigation"
        ></nav>
        <table
          id="table-file"
          style="margin-top: 10px;"
          class="table table-striped table-bordered table-hover"
          cellspacing="0"
          width="100%"
        ></table>
      </form>`,
    title: "Files",
    callback: function () {
      new tables["file"]();
    },
  });
}

function saveSettings() {
  const newSettings = jsonEditors.settings.get();
  call({
    url: "/save_settings",
    data: {
      settings: newSettings,
      save: $("#settings_panel-write_changes").prop("checked"),
    },
    callback: function () {
      settings = newSettings;
      $("#settings_panel").remove();
      notify("Settings saved.", "success", 5, true);
    },
  });
}

function showSettings() {
  openPanel({
    name: "settings_panel",
    title: "Settings",
    size: "700px 600px",
    callback: function () {
      jsonEditors.settings.set(settings);
    },
  });
}

function enterFolder(folder) {
  folderPath = `${folderPath}/${folder}`;
  localStorage.setItem("folderPath", folderPath);
  refreshTable("file");
  $("#upward-folder-btn").removeClass("disabled");
}

function enterUpwardFolder() {
  folderPath = folderPath.split("/").slice(0, -1).join("/");
  localStorage.setItem("folderPath", folderPath);
  refreshTable("file");
  if (folderPath == defaultFolder) $("#upward-folder-btn").addClass("disabled");
}

export function openDebugPanel() {
  openPanel({
    name: "debug",
    title: "Debug Panel",
    size: "1200px 500px",
    callback: function () {
      call({
        url: "/load_debug_snippets",
        callback: function (snippets) {
          for (const name of Object.keys(snippets)) {
            $("#debug-snippets").append(`<option value="${name}">${name}</option>`);
          }
          $("#debug-snippets")
            .val("empty.py")
            .on("change", function () {
              const value = snippets[this.value];
              editors[undefined]["code"].setValue(value);
            })
            .selectpicker("refresh");
        },
      });
    },
  });
}

function runDebugCode() {
  call({
    url: "/run_debug_code",
    form: "debug-form",
    callback: function (result) {
      $("#debug-output").val(result);
      notify("Code executed successfully.", "success", 5, true);
    },
  });
}

function getClusterStatus() {
  call({
    url: "/get_cluster_status",
    callback: function () {
      refreshTable("server");
      setTimeout(getClusterStatus, 15000);
    },
  });
}

function migrationsExport() {
  notify("Migration Export initiated.", "success", 5, true);
  call({
    url: "/migration_export",
    form: "migration-form",
    callback: function () {
      notify("Migration Export successful.", "success", 5, true);
    },
  });
}

function scanFolder() {
  call({
    url: `/scan_folder/${folderPath.replace(/\//g, ">")}`,
    callback: function () {
      refreshTable("file");
      notify("Scan successful.", "success", 5, true);
    },
  });
}

function showMigrationPanel() {
  openPanel({
    name: "database_migration",
    title: "Database Migration",
    size: "auto",
    callback: () => {
      call({
        url: "/get_migration_folders",
        callback: function (folders) {
          let list = document.getElementById("versions");
          folders.forEach((item) => {
            let option = document.createElement("option");
            option.textContent = option.value = item;
            list.appendChild(option);
          });
        },
      });
    },
  });
}

function migrationsImport() {
  notify("Inventory Import initiated.", "success", 5, true);
  call({
    url: "/migration_import",
    form: "migration-form",
    callback: function (result) {
      notify(result, "success", 5, true);
    },
  });
}

function databaseDeletion() {
  notify("Starting Database Deletion", "success", 5, true);
  call({
    url: "/database_deletion",
    title: "Database Deletion",
    form: "database_deletion-form",
    callback: function () {
      notify("Database Deletion done.", "success", 5, true);
      $("#database_deletion").remove();
    },
  });
}

function resultLogDeletion() {
  notify("Log Deletion initiated...", "success", 5, true);
  call({
    url: "/result_log_deletion",
    form: "result_log_deletion-form",
    callback: function () {
      notify("Log Deletion done.", "success", 5, true);
      $("#result_log_deletion").remove();
    },
  });
}

function getGitContent() {
  call({
    url: "/get_git_content",
    callback: function () {
      notify("Successfully pulled content from git.", "success", 5, true);
    },
  });
}

function scanCluster() {
  notify("Cluster Scan initiated...", "success", 5, true);
  call({
    url: "/scan_cluster",
    callback: function () {
      notify("Cluster Scan completed.", "success", 5, true);
    },
  });
}

function editFile(filename, filepath) {
  call({
    url: `/edit_file/${filename}`,
    callback: function (content) {
      if (content.error) {
        refreshTable("file");
        return notify(content.error, "error", 5);
      }
      openPanel({
        name: "file_editor",
        title: `Edit ${filepath}`,
        id: filename,
        callback: () => {
          const display = document.getElementById(`file_content-${filename}`);
          // eslint-disable-next-line new-cap
          let fileEditor = (editors[filename] = CodeMirror.fromTextArea(display, {
            lineWrapping: true,
            lineNumbers: true,
            theme: "cobalt",
            mode: "python",
            extraKeys: { "Ctrl-F": "findPersistent" },
          }));
          fileEditor.setSize("100%", "100%");
          fileEditor.setValue(content);
          fileEditor.refresh();
        },
      });
    },
  });
}

function saveFile(file) {
  $(`[id="file_content-${file}"]`).text(editors[file].getValue());
  call({
    url: `/save_file/${file}`,
    form: `file-content-form-${file}`,
    callback: function () {
      notify(`File ${file} successfully saved.`, "success", 5, true);
      $(`[id="file_editor-${file}"`).remove();
      refreshTable("file");
    },
  });
}

function showFileUploadPanel(folder) {
  if (!folder) folder = folderPath;
  const path = folder.replace(/\//g, ">");
  openPanel({
    name: "upload_files",
    title: `Upload files to ${folder}`,
    id: path,
    callback: () => {
      const element = document.getElementById(`dropzone-${path}`);
      let dropzone = new Dropzone(element, {
        url: "/upload_files",
        autoProcessQueue: false,
      });
      $(`[id="dropzone-submit-${path}"]`).click(function () {
        $(`[id="folder-${path}"]`).val(folder);
        dropzone.processQueue();
        notify("Files successfully uploaded.", "success", 5, true);
        $(`[id="upload_files-${path}"]`).remove();
        setTimeout(() => refreshTable("file"), 600);
      });
    },
  });
}

function showProfile() {
  openPanel({
    name: "profile",
    title: "Profile",
    id: user.id,
    callback: () => {
      call({
        url: `/get_properties/user/${user.id}`,
        callback: function (user) {
          for (const [page, endpoint] of Object.entries(rbac.all_pages)) {
            if (!user.is_admin && !user.pages.includes(page)) continue;
            const option = `<option value='${endpoint}'>${page}</option>`;
            $(`#profile-landing_page-${user.id}`).append(option);
          }
          $(`#profile-landing_page-${user.id}`)
            .val(user.landing_page)
            .selectpicker("refresh");
          processInstance("profile", user);
        },
      });
    },
  });
}

function saveProfile() {
  call({
    url: "/save_profile",
    form: `profile-form-${user.id}`,
    callback: function () {
      notify("Profile saved.", "success", 5, true);
      $(`#profile-${user.id}`).remove();
    },
  });
}

export function showCredentialPanel(id) {
  const postfix = id ? `-${id}` : "";
  $(`#credential-subtype${postfix}`)
    .change(function () {
      if (this.value == "password") {
        $(`#credential-private_key-div${postfix}`).hide();
        $(`#credential-password-div${postfix}`).show();
      } else {
        $(`#credential-password-div${postfix}`).hide();
        $(`#credential-private_key-div${postfix}`).show();
      }
    })
    .trigger("change");
}

function openFilePanel() {
  showInstancePanel($("#file-type-list").val());
}

function processFileData() {
  const type = $("#file-type-list").val();
  const filename = $(`#${type}-filename`).val();
  $(`#${type}-path`).val(`${folderPath}/${filename}`);
  call({
    url: "/process_file_data",
    form: `${type}-form`,
    callback: () => {
      $(`#${type}`).remove();
      setTimeout(() => refreshTable("file"), 600);
      notify(`${type.toUpperCase()} '${filename}' created.`, "success", 5, true);
    },
  });
}

configureNamespace("administration", [
  databaseDeletion,
  displayFiles,
  editFile,
  enterFolder,
  enterUpwardFolder,
  getClusterStatus,
  getGitContent,
  migrationsExport,
  migrationsImport,
  openFilePanel,
  processFileData,
  resultLogDeletion,
  runDebugCode,
  saveSettings,
  saveFile,
  saveProfile,
  scanCluster,
  scanFolder,
  showSettings,
  showFileUploadPanel,
  showMigrationPanel,
  showProfile,
]);
