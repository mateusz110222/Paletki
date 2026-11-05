ALTER TABLE pallets DROP CONSTRAINT pallets_model_project_fk;
ALTER TABLE pallets ADD CONSTRAINT pallets_model_project_fk
    FOREIGN KEY (model_id, project_id) REFERENCES pallet_models (id, project_id)
    ON UPDATE CASCADE ON DELETE RESTRICT;
