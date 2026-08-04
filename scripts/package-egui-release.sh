#!/usr/bin/env bash

set -euo pipefail

readonly BINARY_NAME="guitar-tuner-egui"
readonly ARTIFACTS_DIRECTORY="release-artifacts"
readonly WORK_DIRECTORY="package-work"

usage() {
  cat <<'EOF'
Usage:
  package-egui-release.sh package \
    --workspace PATH --runner-os OS --target TARGET --version VERSION \
    --github-output PATH

  package-egui-release.sh verify \
    --workspace PATH --runner-os OS --version VERSION \
    --package-name NAME --package-path PATH

OS must be one of Linux, macOS, or Windows. Paths written to GitHub output are
relative to the supplied workspace so that actions/upload-artifact can use them.
EOF
}

fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

require_option_value() {
  local option="$1"
  local value="${2-}"

  if [[ -z "$value" ]]; then
    fail "Missing value for $option"
  fi
}

parse_options() {
  WORKSPACE=""
  RUNNER_OS_NAME=""
  TARGET_TRIPLE=""
  PACKAGE_VERSION=""
  GITHUB_OUTPUT_FILE=""
  PACKAGE_NAME_VALUE=""
  PACKAGE_PATH_VALUE=""

  while (( $# > 0 )); do
    case "$1" in
      --workspace)
        require_option_value "$1" "${2-}"
        WORKSPACE="$2"
        shift 2
        ;;
      --runner-os)
        require_option_value "$1" "${2-}"
        RUNNER_OS_NAME="$2"
        shift 2
        ;;
      --target)
        require_option_value "$1" "${2-}"
        TARGET_TRIPLE="$2"
        shift 2
        ;;
      --version)
        require_option_value "$1" "${2-}"
        PACKAGE_VERSION="$2"
        shift 2
        ;;
      --github-output)
        require_option_value "$1" "${2-}"
        GITHUB_OUTPUT_FILE="$2"
        shift 2
        ;;
      --package-name)
        require_option_value "$1" "${2-}"
        PACKAGE_NAME_VALUE="$2"
        shift 2
        ;;
      --package-path)
        require_option_value "$1" "${2-}"
        PACKAGE_PATH_VALUE="$2"
        shift 2
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        fail "Unknown option: $1"
        ;;
    esac
  done
}

validate_common_options() {
  [[ -n "$WORKSPACE" ]] || fail "--workspace is required"
  [[ -d "$WORKSPACE" ]] || fail "Workspace does not exist: $WORKSPACE"
  WORKSPACE=$(cd "$WORKSPACE" && pwd -P)

  case "$RUNNER_OS_NAME" in
    Linux|macOS|Windows) ;;
    "") fail "--runner-os is required" ;;
    *) fail "Unsupported runner OS: $RUNNER_OS_NAME" ;;
  esac

  [[ -n "$PACKAGE_VERSION" ]] || fail "--version is required"
  if [[ ! "$PACKAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    fail "Invalid package version: $PACKAGE_VERSION"
  fi
}

validate_target() {
  case "$RUNNER_OS_NAME:$TARGET_TRIPLE" in
    Linux:x86_64-unknown-linux-gnu) ;;
    macOS:aarch64-apple-darwin) ;;
    macOS:x86_64-apple-darwin) ;;
    Windows:x86_64-pc-windows-msvc) ;;
    *:) fail "--target is required for package" ;;
    *) fail "Unsupported target for $RUNNER_OS_NAME: $TARGET_TRIPLE" ;;
  esac
}

require_file() {
  local path="$1"
  local description="$2"

  [[ -s "$path" ]] || fail "$description is missing or empty: $path"
}

render_info_plist() {
  local template_path="$1"
  local destination_path="$2"
  local line
  local placeholder_count

  require_file "$template_path" "Info.plist template"
  placeholder_count=$(grep -o '@VERSION@' "$template_path" | wc -l | tr -d '[:space:]')
  if [[ "$placeholder_count" != "2" ]]; then
    fail "Info.plist template must contain exactly two @VERSION@ placeholders"
  fi

  : > "$destination_path"
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '%s\n' "${line//@VERSION@/$PACKAGE_VERSION}" >> "$destination_path"
  done < "$template_path"
}

write_windows_readme() {
  local destination_path="$1"

  cat > "$destination_path" <<EOF
Guitar Tuner ${PACKAGE_VERSION} for Windows

Run guitar-tuner.exe. This is a portable, unsigned build; Windows may
show a SmartScreen warning. Audio is processed locally on this device.
EOF
}

write_linux_readme() {
  local destination_path="$1"

  cat > "$destination_path" <<EOF
Guitar Tuner ${PACKAGE_VERSION} for Linux

Run ./guitar-tuner-egui from this directory. This is a portable,
unsigned build; audio is processed locally on this device.
EOF
}

package_application() {
  local work_path="$WORKSPACE/$WORK_DIRECTORY"
  local artifacts_path="$WORKSPACE/$ARTIFACTS_DIRECTORY"
  local executable_suffix=""
  local source_path
  local package_name
  local package_path

  validate_target
  [[ -n "$GITHUB_OUTPUT_FILE" ]] || fail "--github-output is required for package"

  if [[ -e "$work_path" || -L "$work_path" || -e "$artifacts_path" || -L "$artifacts_path" ]]; then
    fail "Packaging output directories already exist"
  fi
  mkdir -p "$work_path" "$artifacts_path"

  if [[ "$RUNNER_OS_NAME" == "Windows" ]]; then
    executable_suffix=".exe"
  fi
  source_path="$WORKSPACE/target/$TARGET_TRIPLE/release/${BINARY_NAME}${executable_suffix}"
  require_file "$source_path" "Native executable"

  case "$RUNNER_OS_NAME" in
    macOS)
      local app_name="Guitar Tuner.app"
      local app_path="$work_path/$app_name"
      local platform

      mkdir -p "$app_path/Contents/MacOS" "$app_path/Contents/Resources"
      cp "$source_path" "$app_path/Contents/MacOS/$BINARY_NAME"
      chmod 755 "$app_path/Contents/MacOS/$BINARY_NAME"
      require_file "$WORKSPACE/assets/icons/icon.icns" "macOS application icon"
      cp "$WORKSPACE/assets/icons/icon.icns" "$app_path/Contents/Resources/icon.icns"
      render_info_plist \
        "$WORKSPACE/scripts/assets/Info.plist.template" \
        "$app_path/Contents/Info.plist"
      plutil -lint "$app_path/Contents/Info.plist"

      case "$TARGET_TRIPLE" in
        aarch64-apple-darwin) platform="macos-aarch64" ;;
        x86_64-apple-darwin) platform="macos-x86_64" ;;
      esac
      package_name="guitar-tuner-v${PACKAGE_VERSION}-${platform}.app.zip"
      package_path="$artifacts_path/$package_name"
      /usr/bin/ditto -c -k --sequesterRsrc --keepParent "$app_path" "$package_path"
      ;;

    Windows)
      local bundle_name="guitar-tuner-v${PACKAGE_VERSION}-windows-x86_64"
      local bundle_path="$work_path/$bundle_name"

      mkdir -p "$bundle_path"
      cp "$source_path" "$bundle_path/guitar-tuner.exe"
      require_file "$WORKSPACE/assets/icons/icon.ico" "Windows application icon"
      cp "$WORKSPACE/assets/icons/icon.ico" "$bundle_path/guitar-tuner.ico"
      write_windows_readme "$bundle_path/README.txt"

      package_name="${bundle_name}.zip"
      package_path="$artifacts_path/$package_name"
      (
        cd "$work_path"
        7z a -tzip "$package_path" "$bundle_name"
      )
      ;;

    Linux)
      local bundle_name="guitar-tuner-v${PACKAGE_VERSION}-linux-x86_64"
      local bundle_path="$work_path/$bundle_name"

      mkdir -p "$bundle_path"
      cp "$source_path" "$bundle_path/guitar-tuner-egui"
      chmod 755 "$bundle_path/guitar-tuner-egui"
      require_file "$WORKSPACE/assets/icons/icon.png" "Linux application icon"
      cp "$WORKSPACE/assets/icons/icon.png" "$bundle_path/guitar-tuner.png"
      write_linux_readme "$bundle_path/README.txt"

      package_name="${bundle_name}.tar.gz"
      package_path="$artifacts_path/$package_name"
      tar -czf "$package_path" -C "$work_path" "$bundle_name"
      ;;
  esac

  printf 'name=%s\n' "$package_name" >> "$GITHUB_OUTPUT_FILE"
  printf 'path=%s/%s\n' "$ARTIFACTS_DIRECTORY" "$package_name" >> "$GITHUB_OUTPUT_FILE"
}

verify_archive_entry() {
  local archive_listing="$1"
  local expected_entry="$2"

  grep -Fx "$expected_entry" <<< "$archive_listing" >/dev/null \
    || fail "Release package is missing expected entry: $expected_entry"
}

verify_package() {
  local expected_relative_path
  local absolute_package_path
  local package_count
  local archive_listing

  [[ -n "$PACKAGE_NAME_VALUE" ]] || fail "--package-name is required for verify"
  [[ "$PACKAGE_NAME_VALUE" != */* && "$PACKAGE_NAME_VALUE" != *\\* ]] \
    || fail "Package name must not contain path separators"
  [[ "$PACKAGE_NAME_VALUE" != "." && "$PACKAGE_NAME_VALUE" != ".." ]] \
    || fail "Invalid package name: $PACKAGE_NAME_VALUE"
  [[ -n "$PACKAGE_PATH_VALUE" ]] || fail "--package-path is required for verify"

  expected_relative_path="$ARTIFACTS_DIRECTORY/$PACKAGE_NAME_VALUE"
  if [[ "$PACKAGE_PATH_VALUE" != "$expected_relative_path" ]]; then
    fail "Package output path is inconsistent"
  fi

  absolute_package_path="$WORKSPACE/$PACKAGE_PATH_VALUE"
  require_file "$absolute_package_path" "Expected package"

  package_count=$(find "$WORKSPACE/$ARTIFACTS_DIRECTORY" -maxdepth 1 -type f | wc -l | tr -d '[:space:]')
  if [[ "$package_count" != "1" ]]; then
    printf '::error::Expected exactly one release package, found %s\n' "$package_count" >&2
    find "$WORKSPACE/$ARTIFACTS_DIRECTORY" -maxdepth 1 -type f -print >&2
    exit 1
  fi

  case "$RUNNER_OS_NAME" in
    macOS)
      archive_listing=$(unzip -Z1 "$absolute_package_path")
      verify_archive_entry "$archive_listing" "Guitar Tuner.app/Contents/Info.plist"
      verify_archive_entry "$archive_listing" "Guitar Tuner.app/Contents/MacOS/guitar-tuner-egui"
      verify_archive_entry "$archive_listing" "Guitar Tuner.app/Contents/Resources/icon.icns"
      ;;
    Windows)
      archive_listing=$(7z l "$absolute_package_path")
      grep -F "guitar-tuner.exe" <<< "$archive_listing" >/dev/null \
        || fail "Release package is missing guitar-tuner.exe"
      grep -F "guitar-tuner.ico" <<< "$archive_listing" >/dev/null \
        || fail "Release package is missing guitar-tuner.ico"
      grep -F "README.txt" <<< "$archive_listing" >/dev/null \
        || fail "Release package is missing README.txt"
      ;;
    Linux)
      local archive_root="guitar-tuner-v${PACKAGE_VERSION}-linux-x86_64"

      archive_listing=$(tar -tzf "$absolute_package_path")
      verify_archive_entry "$archive_listing" "$archive_root/guitar-tuner-egui"
      verify_archive_entry "$archive_listing" "$archive_root/guitar-tuner.png"
      verify_archive_entry "$archive_listing" "$archive_root/README.txt"
      ;;
  esac
}

main() {
  local command="${1-}"

  case "$command" in
    package|verify) shift ;;
    --help|-h) usage; exit 0 ;;
    "") usage >&2; exit 2 ;;
    *) fail "Unknown command: $command" ;;
  esac

  parse_options "$@"
  validate_common_options

  case "$command" in
    package) package_application ;;
    verify) verify_package ;;
  esac
}

main "$@"
