"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReviewItems from "./ReviewItems";
import JourneyLegsReview from "./JourneyLegsReview";
import { fetchDraftLegCounts } from "../../lib/journeys/legs";
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
  journeysLoading = false,
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
  savingTo,
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
  removeBusy,
  reviewOpen,
  setReviewOpen,
  removeError,
  cancelRemove,
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
  const [reviewJourneyId, setReviewJourneyId] = useState(null);
  const [reviewAllLocal, setReviewAllLocal] = useState(false);
  const reviewAll = reviewOpen ?? reviewAllLocal;
  const setReviewAll = setReviewOpen ?? setReviewAllLocal;
  const [draftCounts, setDraftCounts] = useState({});

  const refreshDraftCounts = useCallback(() => {
    fetchDraftLegCounts().then(setDraftCounts).catch(() => {});
  }, []);
  useEffect(() => {
    if (activeTab === "Journals") refreshDraftCounts();
  }, [activeTab, refreshDraftCounts]);

  const reviewJourney = reviewJourneyId ? (journeys || []).find((j) => j.id === reviewJourneyId) || null : null;
  const pinsById = useMemo(() => {
    const map = {};
    for (const j of journeys || []) for (const p of j.places || []) map[p.id] = p;
    return map;
  }, [journeys]);

  return (
    <div className="journals-panel" style={{
      position: "absolute",
      top: "0px",
      right: "0px",
      width: "350px",
      bottom: "0px",
      display: "flex",
      flexDirection: "column",
      padding: "1.15rem 1rem",
      zIndex: 100,
      overflow: "hidden",
      gap: "1rem",
      borderRadius: "0px",
      transform: activeTab === "Journals" ? "translateX(0)" : "translateX(100%)",
      // Closed: off screen, hidden after the slide and inert, so the closed panel is never
      // a hit target, never matched by text lookups, and never steals focus or clicks.
      transition: activeTab === "Journals" ? "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s" : "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0.35s",
      visibility: activeTab === "Journals" ? "visible" : "hidden",
      pointerEvents: activeTab === "Journals" ? "auto" : "none"
    }} inert={activeTab === "Journals" ? undefined : true} aria-hidden={activeTab === "Journals" ? undefined : true}>
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
          savingTo={savingTo}
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
          removeBusy={removeBusy}
          removeError={removeError}
          cancelRemove={cancelRemove}
          onBack={onBackFromPin}
        />
      ) : clusterPins ? (
        <ClusterList
          clusterPins={clusterPins}
          onSelectPin={onSelectPin}
          onBack={onBackFromCluster}
        />
      ) : reviewAll ? (
        <ReviewItems
          journeys={journeys}
          onBack={() => { setReviewAll(false); refreshDraftCounts(); }}
          onConfirmed={refreshDraftCounts}
        />
      ) : reviewJourney ? (
        <JourneyLegsReview
          journey={reviewJourney}
          pinsById={pinsById}
          onBack={() => { setReviewJourneyId(null); refreshDraftCounts(); }}
          onConfirmed={refreshDraftCounts}
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
          loading={journeysLoading}
          journeys={journeys}
          onSelectJourney={onSelectJourney}
          onCreateJourney={onCreateJourney}
          onUpdateJourney={onUpdateJourney}
          onSoftDeleteJourney={onSoftDeleteJourney}
          onShareJourney={onShareJourney}
          onStopSharingJourney={onStopSharingJourney}
          draftCounts={draftCounts}
          onReviewLegs={(journey) => setReviewJourneyId(journey.id)}
          onOpenReview={() => setReviewAll(true)}
        />
      )}
    </div>
  );
}
