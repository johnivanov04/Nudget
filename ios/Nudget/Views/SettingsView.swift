import SwiftUI

struct SettingsView: View {
    @StateObject private var vm: SettingsViewModel
    private let onClose: () -> Void
    private let onAccountDeleted: () -> Void

    @State private var showDeleteConfirm = false

    init(token: String, onClose: @escaping () -> Void, onAccountDeleted: @escaping () -> Void) {
        _vm = StateObject(wrappedValue: SettingsViewModel(token: token))
        self.onClose = onClose
        self.onAccountDeleted = onAccountDeleted
    }

    var body: some View {
        NavigationStack {
            Form {
                if vm.isLoading {
                    ProgressView()
                } else {
                    notificationsSection
                    aboutSection
                    dangerSection
                }

                if let error = vm.error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onClose() }
                }
            }
        }
        .task { await vm.load() }
    }

    // MARK: - Sections

    private var notificationsSection: some View {
        Section("Notifications") {
            Toggle("Enable nudges", isOn: bind(\.enabled))
            if vm.prefs.enabled {
                Toggle("Morning runway", isOn: bind(\.morningEnabled))
                Toggle("Upcoming bill", isOn: bind(\.billApproachEnabled))
                Toggle("Tight runway warning", isOn: bind(\.dangerEnabled))

                Picker("Tone", selection: bind(\.tone)) {
                    ForEach(vm.toneOptions, id: \.self) { Text($0.capitalized).tag($0) }
                }
                DatePicker(
                    "Morning nudge",
                    selection: morningTimeBinding,
                    displayedComponents: .hourAndMinute
                )
                .environment(\.timeZone, .current)

                Button {
                    Task { await vm.sendTestNudge() }
                } label: {
                    if vm.isSendingTest {
                        ProgressView()
                    } else {
                        Text("Send a test notification")
                    }
                }
                .disabled(vm.isSendingTest)

                if let testResult = vm.testResult {
                    Text(testResult).font(.footnote).foregroundStyle(.secondary)
                }
            }
        }
    }

    /// Bridges the hour/minute prefs to a `Date` for the time picker (and back).
    private var morningTimeBinding: Binding<Date> {
        Binding(
            get: {
                var comps = DateComponents()
                comps.hour = vm.prefs.morningHour
                comps.minute = vm.prefs.morningMinute
                return Calendar.current.date(from: comps) ?? Date()
            },
            set: { newDate in
                let comps = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                let hour = comps.hour ?? vm.prefs.morningHour
                let minute = comps.minute ?? vm.prefs.morningMinute
                guard hour != vm.prefs.morningHour || minute != vm.prefs.morningMinute else { return }
                vm.prefs.morningHour = hour
                vm.prefs.morningMinute = minute
                Task { await vm.save() }
            }
        )
    }

    private var aboutSection: some View {
        Section("About") {
            LabeledContent("Privacy", value: "Nudget never stores your bank login")
            Text("Estimates for awareness, not financial advice.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var dangerSection: some View {
        Section {
            Button(role: .destructive) {
                showDeleteConfirm = true
            } label: {
                if vm.isDeleting {
                    ProgressView()
                } else {
                    Text("Delete account")
                }
            }
            .disabled(vm.isDeleting)
        } footer: {
            Text("Permanently deletes your account, linked banks, and all data. This can't be undone.")
        }
        .confirmationDialog(
            "Delete your account?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete everything", role: .destructive) {
                Task {
                    if await vm.deleteAccount() { onAccountDeleted() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes your account, linked banks, transactions, and runway — permanently.")
        }
    }

    // MARK: - Helpers

    /// A binding that writes through to the VM and persists on change.
    private func bind<T: Equatable>(_ keyPath: WritableKeyPath<NotificationPreferences, T>) -> Binding<T> {
        Binding(
            get: { vm.prefs[keyPath: keyPath] },
            set: { newValue in
                guard vm.prefs[keyPath: keyPath] != newValue else { return }
                vm.prefs[keyPath: keyPath] = newValue
                Task { await vm.save() }
            }
        )
    }
}
