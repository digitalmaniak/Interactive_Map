"use client";

import AddMemoryForm from "./AddMemoryForm";
import JourneyList from "./JourneyList";
import JourneyPlacesList from "./JourneyPlacesList";
import ClusterList from "./ClusterList";
import PinDetail from "./PinDetail";

/**
 * Right-side Travel Journals panel: shell chrome + mode router.
 * Modes: add entry | pin detail | cluster list | journey places | journey list.
 * State and callbacks owned by MapCanvas; this component only switches views.
 */
export default function JournalsPanel({
  activeTab,
  isAddingEntry,
  activePin,
  activeJourney,
  clusterPins,
  journeys,
  // Add memory
  newPinName,
  setNewPinName,
  newPinCity,
  setNewPinCity,
  newPinStartDate,
  setNewPinStartDate,
  newPinEndDate,
  setNewPinEndDate,
  clickedCoords,
  setClickedCoords,
  newPinDetails,
  setNewPinDetails,
  handleAddPin,
  closeJournalPanel,
  // Pin detail
  isConfirmingDelete,
  setIsConfirmingDelete,
  isEditingPin,
  editPin,
  setEditPin,
  startEditingPin,
  handleUpdatePin,
  setIsEditingPin,
  editingLogId,
  editLog,
  setEditLog,
  startEditingLog,
  handleUpdateLog,
  setEditingLogId,
  handleDeleteLog,
  isAddingLog,
  setIsAddingLog,
  newLogTitle,
  setNewLogTitle,
  newLogContent,
  setNewLogContent,
  newLogCategory,
  setNewLogCategory,
  handleAddLog,
  handleRemovePin,
  onBackFromPin,
  // Lists
  onSelectPin,
  onSelectJourney,
  onBackFromJourney,
  onBackFromCluster,
  onCreateJourney,
  onUpdateJourney,
  onSoftDeleteJourney,
  onShareJourney,
  onStopSharingJourney,
  onMovePlace,
}) {
  return (
    <div className="glass-base" style={{
      position: "absolute",
      top: "0px",
      right: "0px",
      width: "350px",
      bottom: "0px",
      display: "flex",
      flexDirection: "column",
      padding: "1rem",
      zIndex: 100,
      overflow: "hidden",
      gap: "1rem",
      backdropFilter: "none",
      WebkitBackdropFilter: "none",
      borderRadius: "0px",
      borderRight: "none",
      borderBottom: "none",
      borderTop: "none",
      borderLeft: "1px solid #E7E5E4",
      background: "#FAFAF8",
      boxShadow: "-8px 0 28px rgba(28,25,23,0.08)",
      transform: activeTab === "Travel Journals" ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: activeTab === "Travel Journals" ? "auto" : "none"
    }}>
      {isAddingEntry ? (
        <AddMemoryForm
          newPinName={newPinName}
          setNewPinName={setNewPinName}
          newPinCity={newPinCity}
          setNewPinCity={setNewPinCity}
          newPinStartDate={newPinStartDate}
          setNewPinStartDate={setNewPinStartDate}
          newPinEndDate={newPinEndDate}
          setNewPinEndDate={setNewPinEndDate}
          clickedCoords={clickedCoords}
          setClickedCoords={setClickedCoords}
          newPinDetails={newPinDetails}
          setNewPinDetails={setNewPinDetails}
          onAddPin={handleAddPin}
          onCancel={closeJournalPanel}
        />
      ) : activePin ? (
        <PinDetail
          activePin={activePin}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
          isEditingPin={isEditingPin}
          editPin={editPin}
          setEditPin={setEditPin}
          startEditingPin={startEditingPin}
          handleUpdatePin={handleUpdatePin}
          setIsEditingPin={setIsEditingPin}
          editingLogId={editingLogId}
          editLog={editLog}
          setEditLog={setEditLog}
          startEditingLog={startEditingLog}
          handleUpdateLog={handleUpdateLog}
          setEditingLogId={setEditingLogId}
          handleDeleteLog={handleDeleteLog}
          isAddingLog={isAddingLog}
          setIsAddingLog={setIsAddingLog}
          newLogTitle={newLogTitle}
          setNewLogTitle={setNewLogTitle}
          newLogContent={newLogContent}
          setNewLogContent={setNewLogContent}
          newLogCategory={newLogCategory}
          setNewLogCategory={setNewLogCategory}
          handleAddLog={handleAddLog}
          handleRemovePin={handleRemovePin}
          onBack={onBackFromPin}
        />
      ) : clusterPins ? (
        <ClusterList
          clusterPins={clusterPins}
          onSelectPin={onSelectPin}
          onBack={onBackFromCluster}
        />
      ) : activeJourney ? (
        <JourneyPlacesList
          journey={activeJourney}
          journeys={journeys}
          onSelectPin={onSelectPin}
          onBack={onBackFromJourney}
          onMovePlace={onMovePlace}
          onShareJourney={onShareJourney}
          onStopSharingJourney={onStopSharingJourney}
        />
      ) : (
        <JourneyList
          journeys={journeys}
          onSelectJourney={onSelectJourney}
          onCreateJourney={onCreateJourney}
          onUpdateJourney={onUpdateJourney}
          onSoftDeleteJourney={onSoftDeleteJourney}
          onShareJourney={onShareJourney}
          onStopSharingJourney={onStopSharingJourney}
        />
      )}
    </div>
  );
}
